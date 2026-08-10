import { Logger } from '@nestjs/common';
import { configuredJwks } from './oauth.config';
import { importEsm } from './esm-loader';

/**
 * Claves de firma del Authorization Server (ES256). Se resuelven UNA vez al boot
 * y se comparten entre el AS (que firma) y el verificador del Resource Server
 * (que valida) — crítico en dev con claves efímeras: si cada uno generara las
 * suyas, la validación fallaría. Token de inyección: OAUTH_JWKS.
 */

export const OAUTH_JWKS = Symbol('OAUTH_JWKS');

export interface OauthJwks {
  keys: Record<string, unknown>[];
}

const logger = new Logger('OauthKeys');

interface JoseLite {
  generateKeyPair: (alg: string, opts?: { extractable?: boolean; modulusLength?: number }) => Promise<{ privateKey: unknown }>;
  exportJWK: (key: unknown) => Promise<Record<string, unknown>>;
  calculateJwkThumbprint: (jwk: Record<string, unknown>) => Promise<string>;
}

/** Genera un JWK privado firmante (alg dado) con kid = thumbprint. */
async function genSigningJwk(jose: JoseLite, alg: string): Promise<Record<string, unknown>> {
  const { privateKey } = await jose.generateKeyPair(alg, { extractable: true });
  const jwk = await jose.exportJWK(privateKey);
  jwk.alg = alg;
  jwk.use = 'sig';
  jwk.kid = await jose.calculateJwkThumbprint(jwk);
  return jwk;
}

/**
 * JWKS privado: de env FACTORY_OAUTH_JWKS (prod) o par efímero (solo dev).
 * DOS claves: ES256 (firma de los access token del recurso) + RS256 (default de
 * `id_token_signed_response_alg` de los clientes, incl. los que se registran por
 * DCR sin especificar alg). Sin la RSA, un cliente DCR con el default RS256 falla
 * con invalid_client_metadata (D-042b).
 */
export async function resolveOauthJwks(): Promise<OauthJwks> {
  const configured = configuredJwks();
  if (configured) {
    const keys = configured.keys as Record<string, unknown>[];
    // Los clientes que se registran por DCR usan `id_token_signed_response_alg`
    // RS256 por defecto: sin una clave RSA en el JWKS, el registro/autorización
    // falla con invalid_client_metadata. Los JWKS generados antes de D-043 son
    // solo-ES256, así que se completa con una RSA EFÍMERA y se avisa fuerte —
    // preferible a que el conector no conecte. Los access tokens del MCP siguen
    // firmándose con la ES256 configurada (persistente).
    if (!keys.some((k) => k.kty === 'RSA')) {
      const jose = await importEsm<JoseLite>('jose');
      const rsa = await genSigningJwk(jose, 'RS256');
      logger.warn(
        'FACTORY_OAUTH_JWKS no incluye clave RSA (necesaria para clientes DCR): se añadió una EFÍMERA. ' +
          'Regenerá el JWKS con `cli oauth-genkeys` (emite ES256+RS256) y actualizá el .env.'
      );
      return { keys: [...keys, rsa] };
    }
    return { keys };
  }

  const jose = await importEsm<JoseLite>('jose');
  const ec = await genSigningJwk(jose, 'ES256');
  const rsa = await genSigningJwk(jose, 'RS256');
  logger.warn('FACTORY_OAUTH_JWKS ausente — usando claves ES256+RS256 EFÍMERAS (solo dev).');
  return { keys: [ec, rsa] };
}

/** Deriva el JWKS público (sin el componente privado `d`) para el verificador. */
export function toPublicJwks(jwks: OauthJwks): OauthJwks {
  return {
    keys: jwks.keys.map((k) => {
      const pub: Record<string, unknown> = { ...k };
      delete pub.d; // el componente privado de la clave EC nunca sale al verificador
      return pub;
    })
  };
}
