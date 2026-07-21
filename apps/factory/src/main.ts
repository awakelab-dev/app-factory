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

  // 2) Authorization Server Metadata (RFC 8414) en la raíz del host (path-inserted)
  //    → lo resuelve el discovery del provider (openid-configuration).
  const discovery = (req: Request, res: Response): void => {
    req.url = '/.well-known/openid-configuration';
    oidcCallback(req, res);
  };
  server.get('/.well-known/oauth-authorization-server/factory-api/oauth', discovery);
  server.get('/.well-known/openid-configuration/factory-api/oauth', discovery);

  // 3) Interacción (login/consent) — ANTES del catch-all del provider.
  server.get(`${OAUTH_MOUNT_PATH}/interaction/:uid`, renderInteraction(provider));
  server.post(
    `${OAUTH_MOUNT_PATH}/interaction/:uid/login`,
    express.urlencoded({ extended: false }),
    submitLogin(provider, actors)
  );

  // 4) Mount del AS: catch-all bajo /factory-api/oauth. Reescribimos req.url a la
  //    forma relativa al issuer (sin el prefijo del mount) que espera el provider.
  server.use(OAUTH_MOUNT_PATH, (req: Request, res: Response) => {
    req.url = req.originalUrl.replace(/^\/factory-api\/oauth/, '') || '/';
    oidcCallback(req, res);
  });

  // 5) Body parsers para el RESTO (control plane + MCP). El MCP recibe hasta 5MB
  //    de HTML en submit_prototype → límite holgado.
  server.use(express.json({ limit: '6mb' }));
  server.use(express.urlencoded({ extended: false }));

  const port = Number(process.env.FACTORY_PORT ?? 3100);
  await app.listen(port);
  console.log(`awk-factory (control plane + AS) escuchando en http://localhost:${port}/factory-api`);
}

void bootstrap();
