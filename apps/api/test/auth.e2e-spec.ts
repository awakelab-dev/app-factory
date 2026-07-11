import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { getJwtSecret, JWT_EXPIRES_IN } from '../src/core/auth/auth.constants';

/**
 * E2E del cableado auth/RBAC sin base de datos: los guards actúan antes de
 * tocar Prisma, y los tokens se firman aquí con el mismo secreto dev.
 */
describe('auth + RBAC (e2e)', () => {
  let app: INestApplication;
  const jwt = new JwtService({ secret: getJwtSecret(), signOptions: { expiresIn: JWT_EXPIRES_IN } });

  const userToken = () =>
    jwt.signAsync({ sub: 'u-2', email: 'b@awakelab.dev', name: 'User', roles: ['user'] });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('endpoint protegido sin token → 401', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('token corrupto → 401', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer no-es-un-jwt')
      .expect(401);
  });

  it('GET /api/auth/me con token válido devuelve el AuthUser de los claims', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${await userToken()}`)
      .expect(200);
    expect(res.body).toEqual({
      id: 'u-2',
      email: 'b@awakelab.dev',
      displayName: 'User',
      roles: ['user']
    });
  });

  it('endpoint solo-admin con rol user → 403', async () => {
    await request(app.getHttpServer())
      .get('/api/core/users')
      .set('Authorization', `Bearer ${await userToken()}`)
      .expect(403);
  });

  it('dev-login valida el payload con el schema compartido (email inválido → 400)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/dev-login')
      .send({ email: 'esto-no-es-un-email' })
      .expect(400);
  });

  it('hello sigue siendo público', async () => {
    await request(app.getHttpServer()).get('/api/hello').expect(200);
  });
});
