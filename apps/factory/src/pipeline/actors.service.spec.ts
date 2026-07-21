import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { ActorsService, PAT_PREFIX } from './actors.service';

// argon2id vía módulo nativo (@node-rs/argon2): se mockea para tests hermeticos
// (sin binario nativo). `hash:<pw>` es un hash de mentira determinista.
vi.mock('@node-rs/argon2', () => ({
  hash: vi.fn(async (pw: string) => `hash:${pw}`),
  verify: vi.fn(async (h: string, pw: string) => h === `hash:${pw}`)
}));

interface ExistingActor {
  id?: string;
  email: string;
  role: string;
  revokedAt: Date | null;
  passwordHash?: string | null;
}

function buildService(overrides: { existing?: ExistingActor | null; first?: ExistingActor | null } = {}) {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const create = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'actor-1', createdAt: new Date(), revokedAt: null, ...data })
  );
  const update = vi.fn().mockResolvedValue({ id: 'actor-1' });
  const findFirst = vi.fn().mockResolvedValue(overrides.first ?? null);
  const prisma = {
    factoryActor: {
      updateMany,
      create,
      update,
      findFirst,
      findUnique: vi.fn().mockResolvedValue(overrides.existing ?? null)
    },
    $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
  } as unknown as PrismaService;
  return { service: new ActorsService(prisma), prisma, updateMany, create, update, findFirst };
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

// ── Login del Authorization Server propio (docs/08, D-041) ─────────────────
describe('ActorsService.setPassword', () => {
  it('guarda SOLO el hash argon2id del actor activo, nunca la contraseña', async () => {
    const { service, update, findFirst } = buildService({
      first: { id: 'actor-9', email: 'gerente@awakelab.dev', role: 'gerente', revokedAt: null }
    });

    await service.setPassword('gerente@awakelab.dev', 'contraseña-larga-12');

    expect(findFirst).toHaveBeenCalledWith({
      where: { email: 'gerente@awakelab.dev', revokedAt: null },
      orderBy: { createdAt: 'desc' }
    });
    // Se persiste el hash (argon2id real en producción), nunca la contraseña en claro.
    const data = update.mock.calls[0]?.[0]?.data;
    expect(data.passwordHash).toBe('hash:contraseña-larga-12');
  });

  it('rechaza contraseñas de menos de 12 caracteres', async () => {
    const { service } = buildService({
      first: { id: 'a', email: 'g@a.dev', role: 'gerente', revokedAt: null }
    });
    await expect(service.setPassword('g@a.dev', 'corta')).rejects.toThrow();
  });

  it('falla si no hay un actor activo para el email', async () => {
    const { service } = buildService({ first: null });
    await expect(service.setPassword('nadie@a.dev', 'contraseña-larga-12')).rejects.toThrow();
  });
});

describe('ActorsService.verifyCredentials', () => {
  it('devuelve el actor cuando la contraseña coincide con el hash', async () => {
    const { service } = buildService({
      first: {
        id: 'a',
        email: 'gerente@awakelab.dev',
        role: 'gerente',
        revokedAt: null,
        passwordHash: 'hash:secreta-larga-12'
      }
    });

    await expect(service.verifyCredentials('gerente@awakelab.dev', 'secreta-larga-12')).resolves.toEqual({
      email: 'gerente@awakelab.dev',
      role: 'gerente'
    });
  });

  it('null si la contraseña no coincide', async () => {
    const { service } = buildService({
      first: { id: 'a', email: 'g@a.dev', role: 'gerente', revokedAt: null, passwordHash: 'hash:otra-larga-12' }
    });
    await expect(service.verifyCredentials('g@a.dev', 'incorrecta-larga')).resolves.toBeNull();
  });

  it('null si el email no tiene actor con contraseña', async () => {
    const { service } = buildService({ first: null });
    await expect(service.verifyCredentials('g@a.dev', 'lo-que-sea-12')).resolves.toBeNull();
  });
});

describe('ActorsService.findActiveByEmail', () => {
  it('resuelve el actor activo del email (rama del AS en el guard)', async () => {
    const { service } = buildService({
      first: { id: 'a', email: 'gerente@awakelab.dev', role: 'gerente', revokedAt: null }
    });
    await expect(service.findActiveByEmail('gerente@awakelab.dev')).resolves.toEqual({
      email: 'gerente@awakelab.dev',
      role: 'gerente'
    });
  });

  it('null si no hay fila activa (→ 403 en el guard)', async () => {
    const { service } = buildService({ first: null });
    await expect(service.findActiveByEmail('ajeno@a.dev')).resolves.toBeNull();
  });
});
