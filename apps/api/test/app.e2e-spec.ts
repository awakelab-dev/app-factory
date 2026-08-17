import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { helloResponseSchema } from '@awk/types';
import { AppModule } from '../src/app.module';

describe('GET /api/hello (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [await AppModule.register()] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 con el contrato tipado', async () => {
    const res = await request(app.getHttpServer()).get('/api/hello').expect(200);
    const parsed = helloResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
  });

  /**
   * El fallo exacto de D-049, ahora cubierto: un módulo cuyo Nest module no
   * llegó a registrarse compila y tipa perfectamente, y sus rutas simplemente
   * NO existen (404). Con el descubrimiento automático (incremento D, bloque 1)
   * las rutas de los módulos de negocio están montadas sin que nadie edite
   * `app.module.ts`: sin token responden 401 (el guard corre antes de Prisma),
   * no 404.
   */
  it('las rutas de los módulos de negocio descubiertos están montadas (401, no 404)', async () => {
    await request(app.getHttpServer()).get('/api/reserva-salas/salas').expect(401);
    await request(app.getHttpServer()).get('/api/incidencias-aula/incidencias').expect(401);
    await request(app.getHttpServer()).get('/api/moodle-insights/summary').expect(401);
  });
});
