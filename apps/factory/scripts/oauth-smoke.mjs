#!/usr/bin/env node
// Smoke del Authorization Server propio del conector Cowork (docs/08 / D-041,
// runbook §2.e). Se corre CONTRA STAGING (o local), NUNCA en el sandbox de
// Cowork (sin red al server). Node 22+ (fetch global, sin dependencias).
//
// Uso:
//   node apps/factory/scripts/oauth-smoke.mjs \
//     --base https://staging.apps.awakelab.world \
//     --client-id claude --client-secret <secret> \
//     --email gerente@awakelab.dev --password '<pwd>'
//
// Comprueba, en orden (y para en el primer fallo, indicando el PUNTO exacto —
// runbook §3.5): PRM (RFC 9728, ambas formas) → ASM/openid-configuration del AS
// (bajo el issuer y en la raíz path-inserted) → 401 + WWW-Authenticate en /mcp →
// flujo Authorization Code + PKCE completo (login usuario/contraseña por POST) →
// token → tools/list del MCP (espera 5 tools).

import { createHash, randomBytes } from 'node:crypto';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);
const BASE = (args.base ?? 'http://localhost:3100').replace(/\/+$/, '');
const CLIENT_ID = args['client-id'] ?? 'claude';
const CLIENT_SECRET = args['client-secret'] ?? 'dev-claude-secret-no-usar-en-produccion';
const REDIRECT_URI = args['redirect-uri'] ?? 'https://claude.ai/api/mcp/auth_callback';
const EMAIL = args.email;
const PASSWORD = args.password;
const RESOURCE = `${BASE}/factory-api/mcp`;
const ISSUER = `${BASE}/factory-api/oauth`;

const b64url = (buf) => buf.toString('base64url');
let step = 0;
const ok = (msg) => console.log(`  ✔ ${msg}`);
const fail = (msg, extra) => {
  console.error(`\n✖ FALLO en el paso ${step}: ${msg}`);
  if (extra) console.error(extra);
  process.exit(1);
};
const head = (n, title) => {
  step = n;
  console.log(`\n[${n}] ${title}`);
};

async function getJson(url) {
  const res = await fetch(url, { redirect: 'manual' });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    /* deja json undefined */
  }
  return { res, text, json };
}

// ── Cookie jar mínimo para el flujo interactivo ────────────────────────────
const jar = new Map();
function storeCookies(res) {
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
const cookieHeader = () =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

async function main() {
  console.log(`Smoke OAuth AS — base=${BASE}`);

  // 1) PRM (RFC 9728) — forma canónica y forma del runbook.
  head(1, 'Protected Resource Metadata (RFC 9728)');
  for (const url of [
    `${BASE}/.well-known/oauth-protected-resource/factory-api/mcp`,
    `${BASE}/factory-api/.well-known/oauth-protected-resource`
  ]) {
    const { res, json, text } = await getJson(url);
    if (res.status !== 200 || !json) fail(`PRM ${url} → ${res.status}`, text);
    if (json.resource !== RESOURCE) fail(`PRM.resource ≠ ${RESOURCE}`, text);
    if (!json.authorization_servers?.includes(ISSUER)) fail(`PRM.authorization_servers no incluye ${ISSUER}`, text);
    ok(`${url} → resource + AS correctos`);
  }

  // 2) ASM / openid-configuration del AS (RFC 8414) — bajo el issuer y en la raíz.
  head(2, 'Authorization Server Metadata (RFC 8414)');
  let asm;
  for (const url of [
    `${ISSUER}/.well-known/openid-configuration`,
    `${BASE}/.well-known/oauth-authorization-server/factory-api/oauth`,
    `${BASE}/.well-known/openid-configuration/factory-api/oauth`
  ]) {
    const { res, json, text } = await getJson(url);
    if (res.status !== 200 || !json) fail(`ASM ${url} → ${res.status}`, text);
    if (json.issuer !== ISSUER) fail(`ASM.issuer ≠ ${ISSUER} (fue ${json.issuer})`, text);
    if (!json.authorization_endpoint || !json.token_endpoint) fail('ASM sin authorization/token endpoint', text);
    asm ??= json;
    ok(`${url} → issuer + endpoints correctos`);
  }
  if (!(asm.scopes_supported ?? []).includes('offline_access')) {
    fail('ASM.scopes_supported no incluye offline_access (no habrá refresh token)');
  }
  ok('scopes_supported incluye offline_access');

  // 3) 401 + WWW-Authenticate en /mcp sin token.
  head(3, '401 + WWW-Authenticate en /factory-api/mcp');
  const noAuth = await fetch(RESOURCE, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  });
  if (noAuth.status !== 401) fail(`/mcp sin token → ${noAuth.status} (esperado 401)`);
  const wwwAuth = noAuth.headers.get('www-authenticate') ?? '';
  if (!/resource_metadata=/.test(wwwAuth)) fail(`WWW-Authenticate sin resource_metadata: "${wwwAuth}"`);
  ok(`401 con WWW-Authenticate: ${wwwAuth}`);

  if (!EMAIL || !PASSWORD) {
    console.log('\n(Sin --email/--password: salto el flujo de token. Los checks de metadata pasaron.)');
    return;
  }

  // 4) Authorization Code + PKCE con login usuario/contraseña por POST.
  head(4, 'Flujo Authorization Code + PKCE (login usuario/contraseña)');
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(16));
  const authUrl =
    `${asm.authorization_endpoint}?response_type=code&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent('offline_access')}` +
    `&resource=${encodeURIComponent(RESOURCE)}&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`;

  // Seguir redirecciones a mano preservando cookies; parar al llegar al redirect_uri externo.
  let url = authUrl;
  let code;
  for (let hop = 0; hop < 8; hop += 1) {
    const res = await fetch(url, { redirect: 'manual', headers: { cookie: cookieHeader() } });
    storeCookies(res);
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      if (loc.startsWith(REDIRECT_URI)) {
        code = new URL(loc).searchParams.get('code');
        break;
      }
      url = loc.startsWith('http') ? loc : `${BASE}${loc}`;
      // Al llegar a la pantalla de interacción (login), hacemos el POST y seguimos.
      if (/\/factory-api\/oauth\/interaction\//.test(url) && !/\/login$/.test(url)) {
        const form = new URLSearchParams({ email: EMAIL, password: PASSWORD });
        const login = await fetch(`${url}/login`, {
          method: 'POST',
          redirect: 'manual',
          headers: { cookie: cookieHeader(), 'content-type': 'application/x-www-form-urlencoded' },
          body: form
        });
        storeCookies(login);
        const lloc = login.headers.get('location');
        if (!lloc) fail(`POST login → ${login.status} sin redirección (¿credenciales?)`, await login.text());
        url = lloc.startsWith('http') ? lloc : `${BASE}${lloc}`;
      }
      continue;
    }
    fail(`Redirección inesperada en el flujo (hop ${hop}): status ${res.status}`, await res.text());
  }
  if (!code) fail('No se obtuvo el authorization code al final del flujo');
  ok('Authorization code obtenido');

  // 5) Token endpoint.
  head(5, 'Token endpoint (canje del code)');
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const tokenRes = await fetch(asm.token_endpoint, {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      resource: RESOURCE
    })
  });
  const tokenJson = await tokenRes.json().catch(() => null);
  if (tokenRes.status !== 200 || !tokenJson?.access_token) {
    fail(`token endpoint → ${tokenRes.status}`, JSON.stringify(tokenJson));
  }
  ok(`access_token emitido (token_type=${tokenJson.token_type}, refresh=${Boolean(tokenJson.refresh_token)})`);

  // 6) tools/list del MCP con el access token.
  head(6, 'tools/list del MCP con el access token');
  const init = await fetch(RESOURCE, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokenJson.access_token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } }
    })
  });
  if (init.status !== 200) fail(`initialize → ${init.status}`, await init.text());
  const listRes = await fetch(RESOURCE, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokenJson.access_token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  });
  const listText = await listRes.text();
  if (listRes.status !== 200) fail(`tools/list → ${listRes.status}`, listText);
  const tools = (listText.match(/"name":\s*"(list_modules|submit_prototype|get_project_status|request_change|approve_spec)"/g) ?? []);
  if (tools.length < 5) fail(`tools/list devolvió ${tools.length} tools (esperado 5)`, listText);
  ok('MCP autenticado por OAuth: 5 tools visibles');

  console.log('\n✅ SMOKE OK — el Authorization Server y el Resource Server están listos para la Fase 2.');
}

main().catch((e) => fail('excepción no controlada', e?.stack ?? String(e)));
