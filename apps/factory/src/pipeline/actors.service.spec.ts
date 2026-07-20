import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { ActorsService, PAT_PREFIX } from './actors.service';

function buildService(overrides: { existing?: { email: string; role: string; revokedAt: Date | null } | null } = {}) {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const create = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'actor-1', createdAt: new Date(), revokedAt: null, ...data })
  );
  const prisma = {
    factoryActor: {
      updateMany,
      create,
      findUnique: vi.fn().mockResolvedValue(overrides.existing ?? null)
    },
    $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
  } as unknown as PrismaService;
  return { service: new ActorsService(prisma), prisma, updateMany, create };
}

describe('ActorsService.createActor', () => {
  it('emite un PAT con prefijo awkf_, guarda SOLO el hash y revoca los tokens previos del email', async () => {
    const { service, updateMany, create } = buildService();

    const result = await service.createActor({ email: 'gerente@awakelab.dev', role: 'gerente' });

    expect(result.token.startsWith(PAT_PREFIX)).toBe(true);
    // 32 bytes hex + prefijo: alta entropía, no adivinable.
    expect(result.token.length).toBe(PAT_PREFIX.length + 64);
    const written = create.mock.calls[0]?.[0]?.data;
    expect(written.tokenHash).toBe(ActorsService.hashToken(result.token));
    expect(written.tokenHash).not.toContain(result.token.slice(PAT_PREFIX.length)); // nunca en claro
    expect(updateMany).toHaveBeenCalledWith({
      where: { email: 'gerente@awakelab.dev', revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
  });

  it('cada emisión produce un token distinto', async () => {
    const { service } = buildService();
    const a = await service.createActor({ email: 'x@y.dev', role: 'gerente' });
    const b = await service.createActor({ email: 'x@y.dev', role: 'gerente' });
    expect(a.token).not.toBe(b.token);
  });
});

describe('ActorsService.revokeActor', () => {
  it('revoca todos los tokens activos del email y devuelve el conteo', async () => {
    const { service, updateMany } = buildService();

    await expect(service.revokeActor('gerente@awakelab.dev')).resolves.toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { email: 'gerente@awakelab.dev', revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
  });
});

describe('ActorsService.findActiveByToken', () => {
  it('resuelve un PAT activo a su actor {email, rol}', async () => {
    const { service, prisma } = buildService({
      existing: { email: 'gerente@awakelab.dev', role: 'gerente', revokedAt: null }
    });

    const actor = await service.findActiveByToken('awkf_token');

    expect(actor).toEqual({ email: 'gerente@awakelab.dev', role: 'gerente' });
    // El lookup va por hash, nunca por el token en claro.
    expect(prisma.factoryActor.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: ActorsService.hashToken('awkf_token') }
    });
  });

  it('null si el token está revocado', async () => {
    const { service } = buildService({
      existing: { email: 'gerente@awakelab.dev', role: 'gerente', revokedAt: new Date() }
    });

    await expect(service.findActiveByToken('awkf_token')).resolves.toBeNull();
  });

  it('null si el token no existe', async () => {
    const { service } = buildService({ existing: null });

    await expect(service.findActiveByToken('awkf_desconocido')).resolves.toBeNull();
  });
});

describe('ActorsService.isPat', () => {
  it('distingue PATs de JWTs por el prefijo', () => {
    expect(ActorsService.isPat('awkf_abc')).toBe(true);
    expect(ActorsService.isPat('eyJhbGciOi...')).toBe(false);
  });
});
