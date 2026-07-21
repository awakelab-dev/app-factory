import { Inject, Injectable, Logger } from '@nestjs/common';
import { importEsm } from './esm-loader';
import { mcpResource, oauthIssuer } from './oauth.config';
import { OAUTH_JWKS, type OauthJwks, toPublicJwks } from './oauth-keys';

/**
 * Verificador del access token JWT que emite NUESTRO Authorization Server
 * (docs/08 §3, runbook §2.c paso 9 — el "Resource Server"). Valida con jose:
 * firma (JWKS pública ES256 propia), `iss` = issuer del AS, `aud` = URL canónica
 * del MCP y `exp`. Devuelve el email (`sub`) o null. NO consulta factory_actors:
 * eso lo hace el guard (email → fila activa) para mantener una sola fuente de
 * autorización.
 *
 * jose es ESM-only: se carga y memoiza el keyset local al primer uso.
 */
@Injectable()
export class OauthVerifierService {
  private readonly logger = new Logger('OauthVerifier');
  private verifyFn?: (
    token: string,
    keyset: unknown,
    options: { issuer: string; audience: string }
  ) => Promise<{ payload: { sub?: string } }>;
  private keyset?: unknown;

  constructor(@Inject(OAUTH_JWKS) private readonly jwks: OauthJwks) {}

  private async ensureReady(): Promise<void> {
    if (this.verifyFn && this.keyset) return;
    const { jwtVerify, createLocalJWKSet } = await importEsm<{
      jwtVerify: OauthVerifierService['verifyFn'];
      createLocalJWKSet: (jwks: OauthJwks) => unknown;
    }>('jose');
    this.verifyFn = jwtVerify;
    this.keyset = createLocalJWKSet(toPublicJwks(this.jwks));
  }

  /** Valida el token del AS. Devuelve el email (`sub`) o null si no es válido. */
  async verify(token: string): Promise<{ email: string } | null> {
    try {
      await this.ensureReady();
      const { payload } = await this.verifyFn!(token, this.keyset, {
        issuer: oauthIssuer(),
        audience: mcpResource()
      });
      if (!payload.sub) return null;
      return { email: payload.sub };
    } catch (error) {
      this.logger.debug?.(`Token del AS rechazado: ${(error as Error).message}`);
      return null;
    }
  }
}
