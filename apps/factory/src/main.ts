import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { renderInteraction, submitLogin } from './oauth/oidc-interactions';
import {
  OAUTH_MOUNT_PATH,
  protectedResourceMetadata,
  protectedResourceMetadataPath
} from './oauth/oauth.config';
import { OIDC_PROVIDER, type OidcProviderLike } from './oauth/oidc-provider.types';
import { ActorsService } from './pipeline/actors.service';

/**
 * Servidor HTTP de la Fábrica (control plane D-030 + Authorization Server D-041).
 * Prefijo `factory-api` para que Nginx/Vite enruten por prefijo entre apps/api
 * y apps/factory.
 *
 * El Authorization Server (node-oidc-provider, ESM+Koa) se monta como middleware
 * Express CRUDO, no como controller Nest, por dos motivos:
 *  1. Orden: su mount es un catch-all bajo /factory-api/oauth; los handlers de
 *     interacción (login/consent), que viven bajo ese mismo prefijo, deben ir
 *     ANTES o el provider los interceptaría.
 *  2. Body: el provider parsea sus propios cuerpos (token endpoint, PAR). Por eso
 *     la app se crea con bodyParser:false y los parsers JSON/urlencoded se
 *     registran DESPUÉS del bloque OAuth — que termina la respuesta sin llamar a
 *     next() para /factory-api/oauth/*, así el parser global no toca esos cuerpos.
 *
 * Discovery (RFC 8414/9728) también en la raíz del host (path-inserted), porque
 * el issuer/recurso llevan path — ver runbook §2.d (gotcha de Nginx).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.setGlobalPrefix('factory-api');
  // CORS abierto solo en dev; en prod web y factory comparten origen tras Nginx.
  app.enableCors({ origin: process.env.NODE_ENV === 'production' ? false : true });

  const server = app.getHttpAdapter().getInstance();
  const provider = app.get<OidcProviderLike>(OIDC_PROVIDER);
  const actors = app.get(ActorsService);
  const oidcCallback = provider.callback();

  // 1) Protected Resource Metadata (RFC 9728) — público, en las DOS formas:
  //    la canónica path-inserted (anunciada en WWW-Authenticate) y la del runbook.
  const prm = (_req: Request, res: Response): void => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.type('application/json').send(JSON.stringify(protectedResourceMetadata()));
  };
  server.get(protectedResourceMetadataPath(), prm); // /.well-known/oauth-protected-resource/factory-api/mcp
  server.get('/factory-api/.well-known/oauth-protected-resource', prm);

  // 2) Interacción (login/consent) — ANTES del passthrough del provider (comparten
  //    prefijo y el provider es catch-all).
  server.get(`${OAUTH_MOUNT_PATH}/interaction/:uid`, renderInteraction(provider));
  server.post(
    `${OAUTH_MOUNT_PATH}/interaction/:uid/login`,
    express.urlencoded({ extended: false }),
    submitLogin(provider, actors)
  );

  // 3) Passthrough al Authorization Server. node-oidc-provider monta SUS rutas en
  //    la RAÍZ de donde se le monta (sirve /auth, /token, /.well-known/openid-configuration,
  //    NO las formas con /factory-api/oauth por delante). El `app.use` de Express ya
  //    deja req.url relativo al mount (p. ej. /auth) y fija req.baseUrl=/factory-api/oauth,
  //    que el provider usa para ANUNCIAR los endpoints con ese prefijo (issuer con path).
  //    Por eso NO hay que tocar req.url: reescribirlo a la URL completa hacía que el
  //    provider recibiera /factory-api/oauth/auth y devolviera 404 (verificado en el
  //    entorno real; el 200 que se vio antes era un artefacto de build stale). D-042.
  server.use(OAUTH_MOUNT_PATH, (req: Request, res: Response) => oidcCallback(req, res));

  // 4) Discovery en la raíz del host (RFC 8414 path-inserted, p. ej.
  //    /.well-known/oauth-authorization-server/factory-api/oauth). El provider sirve
  //    estos documentos en SU raíz (/.well-known/...); se reescribe la petición a esa
  //    forma y se fija req.originalUrl al prefijo del issuer para que el provider
  //    anuncie las URLs con /factory-api/oauth (calcula el prefijo = originalUrl − url).
  const asMetaAtRoot = (wellKnown: string) => (req: Request, res: Response): void => {
    (req as Request & { originalUrl: string }).originalUrl = `${OAUTH_MOUNT_PATH}${wellKnown}`;
    req.url = wellKnown;
    oidcCallback(req, res);
  };
  server.get(
    '/.well-known/oauth-authorization-server/factory-api/oauth',
    asMetaAtRoot('/.well-known/oauth-authorization-server')
  );
  server.get(
    '/.well-known/openid-configuration/factory-api/oauth',
    asMetaAtRoot('/.well-known/openid-configuration')
  );

  // 5) Body parsers para el RESTO (control plane + MCP). El MCP recibe hasta 5MB
  //    de HTML en submit_prototype → límite holgado.
  server.use(express.json({ limit: '6mb' }));
  server.use(express.urlencoded({ extended: false }));

  const port = Number(process.env.FACTORY_PORT ?? 3100);
  await app.listen(port);
  console.log(`awk-factory (control plane + AS) escuchando en http://localhost:${port}/factory-api`);
}

void bootstrap();
