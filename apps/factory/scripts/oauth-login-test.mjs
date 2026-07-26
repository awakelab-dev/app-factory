#!/usr/bin/env node
// Cliente OAuth de prueba LOCAL para el conector de la Fábrica (docs/08, D-042b).
// Ejercita el flujo REAL sin depender del Owner: abre el navegador contra NUESTRO
// formulario de login, te logueas usuario/contraseña, das consentimiento, y el
// script recibe el code, lo canjea por un token y llama a tools/list del MCP.
//
// Requiere que el AS tenga registrado el cliente público de dev — en el .env del
// server (staging): FACTORY_OAUTH_DEV_REDIRECT=http://localhost:8765/callback
// (NO lo pongas en producción). Node 22+, sin dependencias.
//
// Uso (desde el Mac):
//   node apps/factory/scripts/oauth-login-test.mjs --base https://staging.apps.awakelab.world
// Opcionales: --client-id dev-local  --port 8765  --resource <URL MCP>

import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, c, i, arr) => (c.startsWith('--') ? [...a, [c.slice(2), arr[i + 1]]] : a), [])
);
const BASE = (args.base ?? 'http://localhost:3100').replace(/\/+$/, '');
const CLIENT_ID = args['client-id'] ?? 'dev-local';
const PORT = Number(args.port ?? 8765);
const REDIRECT = `http://localhost:${PORT}/callback`;
const RESOURCE = args.resource ?? `${BASE}/factory-api/mcp`;
const ISSUER = `${BASE}/factory-api/oauth`;
const b64url = (b) => b.toString('base64url');

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    spawn(cmd, [url], { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* si falla, el usuario copia la URL impresa */
  }
}

async function main() {
  // 1) Discovery del AS.
  const asm = await (await fetch(`${ISSUER}/.well-known/openid-configuration`)).json();
  if (!asm.authorization_endpoint) throw new Error(`No se pudo leer el discovery en ${ISSUER}`);

  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(16));
  const authUrl =
    `${asm.authorization_endpoint}?response_type=code&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=${encodeURIComponent('offline_access mcp')}` +
    `&resource=${encodeURIComponent(RESOURCE)}&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`;

  // 2) Servidor local que recibe el callback con el code.
  const codePromise = new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url.startsWith('/callback')) {
        res.writeHead(404).end();
        return;
      }
      const url = new URL(req.url, REDIRECT);
      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const gotState = url.searchParams.get('state');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        `<html><body style="font-family:sans-serif;text-align:center;margin-top:60px">` +
          `<h2>${error ? '❌ ' + error : '✅ Login OK'}</h2>` +
          `<p>Podés cerrar esta pestaña y volver a la terminal.</p></body></html>`
      );
      server.close();
      if (error) return reject(new Error(`Autorización denegada: ${error}`));
      if (gotState !== state) return reject(new Error('state no coincide (posible CSRF)'));
      resolve(code);
    });
    server.listen(PORT, () => {
      console.log(`\nEsperando el login en el navegador (callback en ${REDIRECT})…`);
      console.log(`Si no se abre solo, abrí esta URL:\n${authUrl}\n`);
      openBrowser(authUrl);
    });
  });

  const code = await codePromise;
  console.log('Code recibido, canjeando por token…');

  // 3) Token endpoint (cliente PÚBLICO: sin secret, con code_verifier).
  const tokenRes = await fetch(asm.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: CLIENT_ID,
      code_verifier: verifier,
      resource: RESOURCE
    })
  });
  const token = await tokenRes.json();
  if (!token.access_token) throw new Error(`token endpoint → ${tokenRes.status}: ${JSON.stringify(token)}`);
  console.log(`✔ access_token emitido (refresh=${Boolean(token.refresh_token)}, expira en ${token.expires_in}s)`);

  // 4) tools/list del MCP con el token.
  await fetch(RESOURCE, {
    method: 'POST',
    headers: { authorization: `Bearer ${token.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'login-test', version: '0' } } })
  });
  const listRes = await fetch(RESOURCE, {
    method: 'POST',
    headers: { authorization: `Bearer ${token.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  });
  const text = await listRes.text();
  const tools = [...text.matchAll(/"name":\s*"(list_modules|submit_prototype|get_project_status|request_change|approve_spec)"/g)].map((m) => m[1]);
  if (tools.length < 5) throw new Error(`tools/list devolvió ${tools.length} tools: ${text.slice(0, 300)}`);
  console.log(`✔ MCP autenticado por OAuth — tools: ${tools.join(', ')}`);
  console.log('\n✅ FLUJO REAL OK — el conector funcionaría igual desde Cowork.');
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  process.exit(1);
});
