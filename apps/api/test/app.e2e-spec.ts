import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { helloResponseSchema } from '@awk/types';
import { AppModule } from '../src/app.module';

describe('GET /api/hello (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
});
