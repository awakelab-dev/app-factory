import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { createPrismaOidcAdapter } from './prisma-oidc-adapter';

function buildPrisma(row: Record<string, unknown> | null = null) {
  const oauthModel = {
    upsert: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue(row),
    findFirst: vi.fn().mockResolvedValue(row),
    update: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 })
  };
  return { prisma: { oauthModel } as unknown as PrismaService, oauthModel };
}

describe('PrismaOidcAdapter', () => {
  it('upsert desnormaliza grantId/userCode/uid y calcula expiresAt', async () => {
    const { prisma, oauthModel } = buildPrisma();
    const Adapter = createPrismaOidcAdapter(prisma);
    const ac = new Adapter('AccessToken');

    await ac.upsert('id-1', { grantId: 'g1', uid: 'u1', accountId: 'x@y.dev' }, 3600);

    const call = oauthModel.upsert.mock.calls[0]?.[0];
    expect(call.where).toEqual({ model_id: { model: 'AccessToken', id: 'id-1' } });
    expect(call.create.grantId).toBe('g1');
    expect(call.create.uid).toBe('u1');
    expect(call.create.expiresAt).toBeInstanceOf(Date);
  });

  it('find devuelve el payload y marca consumed si consumedAt está presente', async () => {
    const consumedAt = new Date();
    const { prisma } = buildPrisma({
      payload: { accountId: 'x@y.dev' },
      expiresAt: new Date(Date.now() + 10000),
      consumedAt
    });
    const Adapter = createPrismaOidcAdapter(prisma);
    const found = await new Adapter('RefreshToken').find('id-1');

    expect(found?.accountId).toBe('x@y.dev');
    expect(found?.consumed).toBe(Math.floor(consumedAt.getTime() / 1000));
  });

  it('find devuelve undefined si el registro está expirado', async () => {
    const { prisma } = buildPrisma({
      payload: { accountId: 'x@y.dev' },
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null
    });
    const Adapter = createPrismaOidcAdapter(prisma);
    await expect(new Adapter('AccessToken').find('viejo')).resolves.toBeUndefined();
  });

  it('consume marca consumedAt sin borrar', async () => {
    const { prisma, oauthModel } = buildPrisma();
    await new (createPrismaOidcAdapter(prisma))('AuthorizationCode').consume('code-1');
    expect(oauthModel.update).toHaveBeenCalledWith({
      where: { model_id: { model: 'AuthorizationCode', id: 'code-1' } },
      data: { consumedAt: expect.any(Date) }
    });
  });

  it('revokeByGrantId borra por grantId (no por model+id)', async () => {
    const { prisma, oauthModel } = buildPrisma();
    await new (createPrismaOidcAdapter(prisma))('AccessToken').revokeByGrantId('g1');
    expect(oauthModel.deleteMany).toHaveBeenCalledWith({ where: { grantId: 'g1' } });
  });

  it('findByUid busca por model + uid (Session)', async () => {
    const { prisma, oauthModel } = buildPrisma({ payload: { accountId: 'x@y.dev' }, expiresAt: null, consumedAt: null });
    await new (createPrismaOidcAdapter(prisma))('Session').findByUid('uid-1');
    expect(oauthModel.findFirst).toHaveBeenCalledWith({ where: { model: 'Session', uid: 'uid-1' } });
  });
});
