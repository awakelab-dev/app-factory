import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RolesSeedService } from './core/roles/roles-seed.service';

async function bootstrap(): Promise<void> {
  // `AppModule.register()` y no `AppModule`: los módulos de negocio se
  // descubren (incremento D, bloque 1) y el descubrimiento es asíncrono.
  const app = await NestFactory.create(await AppModule.register());
  app.setGlobalPrefix('api');
  // CORS abierto solo en dev; en prod web y api comparten origen tras Nginx.
  app.enableCors({ origin: process.env.NODE_ENV === 'production' ? false : true });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`awk-api escuchando en http://localhost:${port}/api`);

  // Siembra de roles (incremento D, bloque 2) AQUÍ y no en un hook de Nest: es
  // la única query del arranque, y meterla en el ciclo de vida obligaba a los
  // e2e a tener BD para hacer `app.init()` — rompiendo la conexión perezosa que
  // PrismaService mantiene a propósito. No propaga fallos: si la BD no responde,
  // la API sigue sirviendo y lo deja en el log.
  await app.get(RolesSeedService).seedOnBoot();
}

void bootstrap();
