/**
 * Configuración del Authorization Server propio (docs/08 §3, runbook §2.b).
 * Todo por env; fallbacks SOLO de desarrollo, con guardas duras en producción
 * (mismo criterio que control-plane/auth.constants.ts para JWT_SECRET).
 *
 * URLs canónicas (runbook §intro): minúsculas, sin barra final, con path.
 *   issuer   = https://<host>/factory-api/oauth
 *   resource = https://<host>/factory-api/mcp   (idéntico al que el Owner teclea)
 */

const isProd = (): boolean => process.env.NODE_ENV === 'production';

function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd()) throw new Error(`${name} es obligatoria en producción (docs/08, D-041).`);
  return devFallback;
}

/** Path bajo el que se monta el AS (relativo al host; el prefijo Nest ya incluye factory-api). */
export const OAUTH_MOUNT_PATH = '/factory-api/oauth';

/** Emisor del AS (issuer con path). Sin barra final. */
export function oauthIssuer(): string {
  return (process.env.FACTORY_OAUTH_ISSUER ?? 'http://localhost:3100/factory-api/oauth').replace(/\/+$/, '');
}

/** URL canónica del MCP = audiencia del access token = `resource` que manda Claude. */
export function mcpResource(): string {
  return (process.env.FACTORY_MCP_RESOURCE ?? 'http://localhost:3100/factory-api/mcp').replace(/\/+$/, '');
}

/** Origen (scheme+host) derivado del recurso MCP — base de las URLs de discovery en la raíz del host. */
export function hostOrigin(): string {
  return new URL(mcpResource()).origin;
}

export interface RegisteredClient {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Cliente `claude` pre-registrado (runbook §2.b.5). Secret propio; redirect EXACTO. */
export function registeredClient(): RegisteredClient {
  return {
    clientId: process.env.FACTORY_OAUTH_CLIENT_ID ?? 'claude',
    clientSecret: required('FACTORY_OAUTH_CLIENT_SECRET', 'dev-claude-secret-no-usar-en-produccion'),
    // Redirect URI hosted (incl. Cowork), confirmado en doc oficial de Anthropic.
    redirectUri: process.env.FACTORY_OAUTH_REDIRECT_URI ?? 'https://claude.ai/api/mcp/auth_callback'
  };
}

/** Claves de cookie de las sesiones/interacciones del AS (rotables: la primera firma, todas verifican). */
export function cookieKeys(): string[] {
  const raw = process.env.FACTORY_OAUTH_COOKIE_KEYS;
  if (raw) return raw.split(',').map((k) => k.trim()).filter(Boolean);
  if (isProd()) throw new Error('FACTORY_OAUTH_COOKIE_KEYS es obligatoria en producción (docs/08, D-041).');
  return ['awk-dev-cookie-key-no-usar-en-produccion'];
}

/**
 * JWKS privado (ES256) para firmar los access token JWT. En producción, JSON en
 * FACTORY_OAUTH_JWKS (generado con el CLI `oauth-genkeys`). En dev, si falta, el
 * factory genera un par efímero (tokens no sobreviven a un reinicio — aceptable
 * en local). Devuelve null para señalar "genera uno efímero".
 */
export function configuredJwks(): { keys: unknown[] } | null {
  const raw = process.env.FACTORY_OAUTH_JWKS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { keys?: unknown[] };
      if (Array.isArray(parsed.keys) && parsed.keys.length > 0) return { keys: parsed.keys };
    } catch {
      throw new Error('FACTORY_OAUTH_JWKS no es un JSON válido con { keys: [...] }.');
    }
    throw new Error('FACTORY_OAUTH_JWKS no contiene claves.');
  }
  if (isProd()) throw new Error('FACTORY_OAUTH_JWKS es obligatoria en producción (docs/08, D-041).');
  return null;
}

/** Scope OIDC del AS: `offline_access` habilita el refresh token rotativo. */
export const OAUTH_SCOPES = ['offline_access'] as const;

/**
 * Scope REAL del Resource Server (MCP). `offline_access` es un scope OIDC
 * reservado y node-oidc-provider NO lo pone en el access token de un recurso —
 * sin un scope propio del recurso, la autorización termina "sin scope concedido"
 * y el AS rehúsa emitir (verificado con PG real, D-042). Este es el scope que
 * viaja en el access token del MCP; el guard no lo inspecciona (valida aud+firma),
 * pero el flujo OAuth necesita que ALGO se conceda al recurso.
 */
export const OAUTH_MCP_SCOPE = 'mcp';

/** scopes_supported anunciado en PRM/discovery: el refresh + el scope del MCP. */
export const OAUTH_SCOPES_SUPPORTED = [...OAUTH_SCOPES, OAUTH_MCP_SCOPE] as const;

/**
 * Protected Resource Metadata (RFC 9728, runbook §2.c). `resource` idéntico a
 * la URL del MCP; `authorization_servers` = solo nuestro AS.
 */
export function protectedResourceMetadata() {
  return {
    resource: mcpResource(),
    authorization_servers: [oauthIssuer()],
    scopes_supported: [...OAUTH_SCOPES_SUPPORTED],
    bearer_methods_supported: ['header'] as const
  };
}

/**
 * URL del PRM en su forma canónica RFC 9728 (well-known insertado en la raíz del
 * host, con el path del recurso a continuación). Es la que anunciamos en el
 * header WWW-Authenticate y la que el cliente MCP suele sondear.
 *   https://<host>/.well-known/oauth-protected-resource/factory-api/mcp
 */
export function protectedResourceMetadataUrl(): string {
  const resource = new URL(mcpResource());
  return `${resource.origin}/.well-known/oauth-protected-resource${resource.pathname}`;
}

/** Path (sin host) del PRM canónico — para montar el handler en Express. */
export function protectedResourceMetadataPath(): string {
  return `/.well-known/oauth-protected-resource${new URL(mcpResource()).pathname}`;
}
