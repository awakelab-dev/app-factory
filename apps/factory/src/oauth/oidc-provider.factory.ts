import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { importEsm } from './esm-loader';
import {
  OAUTH_MCP_SCOPE,
  OAUTH_MOUNT_PATH,
  OAUTH_SCOPES,
  cookieKeys,
  devClient,
  mcpResource,
  oauthIssuer,
  registeredClient
} from './oauth.config';
import type { OauthJwks } from './oauth-keys';
import { createPrismaOidcAdapter } from './prisma-oidc-adapter';
import type { OidcProviderLike } from './oidc-provider.types';

const logger = new Logger('OidcProvider');

/**
 * Construye el Authorization Server (docs/08 §3, runbook §2.b). node-oidc-provider
 * es la librería OIDC vetada (checklist de idoneidad = GO, D-041): OpenID
 * certified, OAuth 2.1, mantenida (v9.10.0). Aquí se le pasa la política que
 * exige el spec MCP:
 *
 *  - PKCE S256 obligatorio (pkce.required).
 *  - Refresh tokens rotativos (rotateRefreshToken) para el cliente público-con-secret.
 *  - Resource Indicators RFC 8707: el access token es JWT ES256 con `aud` = URL
 *    canónica del MCP (getResourceServerInfo). Solo se admite ESE recurso.
 *  - Login usuario/contraseña en NUESTRO formulario (interactions.url + devInteractions off).
 *  - Persistencia en Postgres vía adapter Prisma.
 */
export async function createOidcProvider(prisma: PrismaService, jwks: OauthJwks): Promise<OidcProviderLike> {
  const { default: Provider, errors } = await importEsm<{
    default: new (issuer: string, config: unknown) => OidcProviderLike;
    errors: { InvalidTarget: new () => Error };
  }>('oidc-provider');

  const issuer = oauthIssuer();
  const resource = mcpResource();
  const client = registeredClient();
  const dev = devClient();

  const configuration = {
    adapter: createPrismaOidcAdapter(prisma),
    clients: [
      {
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uris: [client.redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        // Confidencial (tiene secret) PERO además usa PKCE — como Anthropic
        // pre-registra Client ID/Secret al alta del custom connector.
        token_endpoint_auth_method: 'client_secret_basic',
        // Mismos scopes que anuncia la PRM: el metadato `scope` del cliente ACOTA
        // lo que puede pedir, así que debe incluir `mcp` (si no, el request con
        // "offline_access mcp" no obtiene código). D-043.
        scope: [...OAUTH_SCOPES, OAUTH_MCP_SCOPE].join(' '),
        // Nuestra JWKS es solo ES256 (sin RSA). El default de este campo es RS256,
        // que sin clave RSA hace fallar la request de autorización con
        // invalid_client_metadata. Lo fijamos a ES256 (aunque no emitamos id_token
        // en el flujo puro-OAuth, el provider valida este metadato igual). D-042.
        id_token_signed_response_alg: 'ES256'
      },
      // Cliente PÚBLICO de prueba local (solo si FACTORY_OAUTH_DEV_REDIRECT está
      // seteada — staging/dev, nunca producción). Permite ejercitar el flujo real
      // (login+consent en el navegador) sin depender del Owner. D-042b.
      ...(dev
        ? [
            {
              client_id: dev.clientId,
              redirect_uris: [dev.redirectUri],
              grant_types: ['authorization_code', 'refresh_token'],
              response_types: ['code'],
              // Público (sin secret): PKCE obligatorio + redirect loopback.
              token_endpoint_auth_method: 'none',
              scope: [...OAUTH_SCOPES, OAUTH_MCP_SCOPE].join(' '),
              id_token_signed_response_alg: 'ES256'
            }
          ]
        : []),
    ],
    jwks,
    cookies: { keys: cookieKeys() },
    // `mcp` va TAMBIÉN como scope del AS, no solo del recurso: lo anunciamos en la
    // PRM (`scopes_supported`) y los clientes que se auto-registran por DCR —Claude
    // lo hace— lo repiten en el metadato `scope` del registro, que se valida contra
    // ESTA lista. Sin él: "scope must only contain Authorization Server supported
    // scope values" → invalid_client_metadata y el conector no llega a conectar
    // (visto en staging con Claude real, D-043). La audiencia/permiso efectivo lo
    // sigue fijando getResourceServerInfo por recurso.
    scopes: [...OAUTH_SCOPES, OAUTH_MCP_SCOPE],
    // Sin OIDC: es OAuth puro para MCP. `sub` = email del actor.
    claims: { openid: ['sub'] },
    pkce: { required: () => true },
    rotateRefreshToken: true,
    // Emitir refresh token para el cliente `claude` aunque no venga `openid` en el
    // request. offline_access, en el flujo puro-OAuth de MCP (sin OIDC), lo descarta
    // la semántica OIDC → sin este override no habría refresh y Claude tendría que
    // re-autenticarse cada hora. El cliente permite el grant refresh_token. D-042.
    async issueRefreshToken(_ctx: unknown, client: { grantTypeAllowed(t: string): boolean }, _code: unknown) {
      return client.grantTypeAllowed('refresh_token');
    },
    ttl: {
      AccessToken: 60 * 60, // 1h (getResourceServerInfo puede afinar por recurso)
      AuthorizationCode: 60,
      RefreshToken: 14 * 24 * 60 * 60, // 14d, extendido por rotación
      Interaction: 60 * 60,
      Session: 14 * 24 * 60 * 60,
      Grant: 14 * 24 * 60 * 60
    },
    // El actor se identifica por email (accountId). No hay perfil OIDC.
    async findAccount(_ctx: unknown, id: string) {
      return {
        accountId: id,
        async claims() {
          return { sub: id, email: id };
        }
      };
    },
    interactions: {
      // El browser va a NUESTRO formulario de login (montado en main.ts).
      url(_ctx: unknown, interaction: { uid: string }) {
        return `${OAUTH_MOUNT_PATH}/interaction/${interaction.uid}`;
      }
    },
    features: {
      // Vistas de interacción de ejemplo de la librería: FUERA (usamos las nuestras).
      devInteractions: { enabled: false },
      // Dynamic Client Registration (RFC 7591): cada cliente Claude (de cualquier
      // cuenta/organización) se auto-registra al conectarse — sin pre-registrar
      // Client ID/Secret por org. Es el mecanismo del spec MCP para escalar a muchas
      // cuentas independientes (D-042b). Registro abierto (sin initial access token,
      // como esperan los clientes MCP); el gate de acceso real sigue siendo el login
      // contra `factory_actors`, y los tokens quedan atados por `aud` al MCP — un
      // cliente registrado sin login no puede nada.
      registration: { enabled: true, initialAccessToken: false },
      resourceIndicators: {
        enabled: true,
        // Si Claude omite `resource`, apuntamos al MCP igualmente.
        defaultResource: () => resource,
        // Permite reusar el recurso ya concedido en el refresh sin re-pedirlo.
        useGrantedResource: () => true,
        getResourceServerInfo(_ctx: unknown, resourceIndicator: string) {
          // Solo el MCP pre-registrado; cualquier otro `resource` → invalid_target.
          if (resourceIndicator !== resource) {
            throw new errors.InvalidTarget();
          }
          return {
            scope: OAUTH_MCP_SCOPE, // scope propio del recurso (no offline_access, reservado)
            audience: resource, // `aud` del JWT = URL canónica del MCP
            accessTokenTTL: 60 * 60,
            accessTokenFormat: 'jwt' as const,
            jwt: { sign: { alg: 'ES256' } }
          };
        }
      }
    }
  };

  const provider = new Provider(issuer, configuration);
  // Detrás del Nginx del host (TLS offloading): confiar en x-forwarded-proto/for
  // para emitir URLs https correctas y marcar las cookies como secure.
  provider.proxy = true;

  // Trazabilidad de errores del AS (si no, un access_denied llega opaco a Claude).
  const emitter = provider as unknown as {
    on(ev: string, cb: (ctx: unknown, err: { error?: string; error_description?: string; error_detail?: string; message?: string; stack?: string }) => void): void;
  };
  emitter.on('authorization.error', (_ctx, err) =>
    logger.warn(`authorization.error: ${err.error} — ${err.error_description ?? ''} — ${err.error_detail ?? ''}`)
  );
  emitter.on('interaction.error', (_ctx, err) =>
    logger.warn(`interaction.error: ${err.error} — ${err.error_description ?? ''} — ${err.error_detail ?? ''}`)
  );
  emitter.on('server_error', (_ctx, err) => logger.error(`server_error: ${err.message} ${err.stack ?? ''}`));

  // Registro dinámico (DCR): si Claude manda un metadato que no aceptamos, sin
  // esto el motivo se pierde y el cliente solo ve "couldn't register". Se loguea
  // el error Y el cuerpo recibido para poder ajustar la política. D-043.
  const onRegError = (ctx: unknown, err: { error?: string; error_description?: string; error_detail?: string }) => {
    let body = '';
    try {
      const oidc = (ctx as { oidc?: { body?: unknown } } | undefined)?.oidc;
      body = JSON.stringify(oidc?.body ?? {});
    } catch {
      body = '(no serializable)';
    }
    logger.warn(
      `registration.error: ${err.error} — ${err.error_description ?? ''} — ${err.error_detail ?? ''} | payload=${body}`
    );
  };
  emitter.on('registration_create.error', onRegError);
  emitter.on('registration_update.error', onRegError);
  emitter.on('registration_read.error', onRegError);
  logger.log(`Authorization Server listo — issuer=${issuer} resource=${resource}`);
  return provider;
}
