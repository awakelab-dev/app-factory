import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Servidor HTTP del control plane (D-030, paso 2 de D-026). Solo expone
 * lectura del pipeline + decisión de gates (ControlPlaneModule) — los
 * runners de análisis/generación siguen operándose por CLI (src/cli.ts):
 * son runs largos del Agent SDK y sin cola de trabajos (Fase 3, D-029) no
 * corresponde dispararlos desde una request HTTP.
 *
 * Prefijo `factory-api` (no `api`): en dev el proxy de Vite y en prod el
 * Nginx del host distinguen por prefijo a qué contenedor enrutar cada
 * request del mismo origen (apps/api vs apps/factory).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('factory-api');
  // CORS abierto solo en dev; en prod web y factory comparten origen tras Nginx.
  app.enableCors({ origin: process.env.NODE_ENV === 'production' ? false : true });
  const port = Number(process.env.FACTORY_PORT ?? 3100);
  await app.listen(port);
  console.log(`awk-factory (control plane) escuchando en http://localhost:${port}/factory-api`);
}

void bootstrap();
