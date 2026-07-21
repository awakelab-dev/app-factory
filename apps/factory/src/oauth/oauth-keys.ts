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

/** JWKS privado ES256: de env FACTORY_OAUTH_JWKS (prod) o par efímero (solo dev). */
export async function resolveOauthJwks(): Promise<OauthJwks> {
  const configured = configuredJwks();
  if (configured) return { keys: configured.keys as Record<string, unknown>[] };

  const { generateKeyPair, exportJWK, calculateJwkThumbprint } = await importEsm<{
    generateKeyPair: (alg: string, opts?: { extractable?: boolean }) => Promise<{ privateKey: unknown }>;
    exportJWK: (key: unknown) => Promise<Record<string, unknown>>;
    calculateJwkThumbprint: (jwk: Record<string, unknown>) => Promise<string>;
  }>('jose');
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  const jwk = await exportJWK(privateKey);
  jwk.alg = 'ES256';
  jwk.use = 'sig';
  jwk.kid = await calculateJwkThumbprint(jwk);
  logger.warn('FACTORY_OAUTH_JWKS ausente — usando un par ES256 EFÍMERO (solo dev).');
  return { keys: [jwk] };
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
