import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // CORS abierto solo en dev; en prod web y api comparten origen tras Nginx.
  app.enableCors({ origin: process.env.NODE_ENV === 'production' ? false : true });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`awk-api escuchando en http://localhost:${port}/api`);
}

void bootstrap();
