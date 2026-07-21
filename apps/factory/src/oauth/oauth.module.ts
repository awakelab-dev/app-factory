import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OAUTH_JWKS, type OauthJwks, resolveOauthJwks } from './oauth-keys';
import { OauthVerifierService } from './oauth-verifier.service';
import { createOidcProvider } from './oidc-provider.factory';
import { OIDC_PROVIDER } from './oidc-provider.types';

/**
 * Authorization Server + verificación del Resource Server (docs/08, D-041).
 * Provee, como singletons asíncronos construidos al boot:
 *  - OAUTH_JWKS: las claves ES256 (env o efímeras), compartidas por AS y RS.
 *  - OIDC_PROVIDER: el provider de node-oidc-provider (carga ESM dinámica +
 *    adapter Prisma), que main.ts monta en Express.
 *  - OauthVerifierService: valida el JWT del AS en el guard (RS).
 *
 * PrismaService es global (PrismaModule @Global) — se inyecta directo.
 */
@Module({
  providers: [
    { provide: OAUTH_JWKS, useFactory: () => resolveOauthJwks() },
    {
      provide: OIDC_PROVIDER,
      inject: [PrismaService, OAUTH_JWKS],
      useFactory: (prisma: PrismaService, jwks: OauthJwks) => createOidcProvider(prisma, jwks)
    },
    OauthVerifierService
  ],
  exports: [OIDC_PROVIDER, OAUTH_JWKS, OauthVerifierService]
})
export class OauthModule {}
