import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service';
import type { RolesService } from '../roles/roles.service';
import { UsersService } from './users.service';

const CREATED_AT = new Date('2026-08-17T10:00:00.000Z');

const GERENTE = {
  id: 'u-9',
  email: 'prueba.gerente@awakelab.dev',
  displayName: 'Prueba Gerente',
  isActive: true,
  createdAt: CREATED_AT,
  roles: [] as Array<{ role: { name: string } }>
};

function build(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue([GERENTE]),
      findUnique: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn().mockResolvedValue(GERENTE),
      create: vi.fn().mockResolvedValue(GERENTE),
      update: vi.fn().mockResolvedValue({ ...GERENTE, isActive: false })
    },
    ...overrides
  };
  const roles = {
    setUserRoles: vi.fn().mockResolvedValue({
      id: GERENTE.id,
      email: GERENTE.email,
      displayName: GERENTE.displayName,
      isActive: true,
      roles: ['user'],
      createdAt: CREATED_AT.toISOString()
    })
  } as unknown as RolesService;
  const audit = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  return { service: new UsersService(prisma as never, roles, audit), prisma, roles, audit };
}

/**
 * Alta y baja de usuarios de plataforma (incremento D, bloque 2 — cierre). El
 * caso que lo motivó: `prueba.gerente@awakelab.dev` existía como actor de la
 * Fábrica (otra BD) pero NO como usuario de plataforma, así que no podía entrar
 * a staging a validar su módulo sin un INSERT a mano.
 */
describe('UsersService (alta/baja sin SQL)', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('crea el usuario, normaliza el email y lo audita', async () => {
    const created = await ctx.service.create(
      { email: '  Prueba.Gerente@Awakelab.dev ', displayName: '  Prueba Gerente  ', roles: [] },
      'admin-1'
    );

    expect(ctx.prisma.user.create).toHaveBeenCalledWith({
      data: { email: 'prueba.gerente@awakelab.dev', displayName: 'Prueba Gerente' }
    });
    expect(ctx.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'core.user_created', actorId: 'admin-1', entityId: 'u-9' })
    );
    expect(created.email).toBe('prueba.gerente@awakelab.dev');
    expect(created.roles).toEqual([]);
    // Sin roles pedidos no se llama al servicio de roles.
    expect(ctx.roles.setUserRoles).not.toHaveBeenCalled();
  });

  it('delega los roles iniciales en RolesService (que valida y audita), no los crea al vuelo', async () => {
    const created = await ctx.service.create(
      { email: 'x@awakelab.dev', displayName: 'X', roles: ['user'] },
      'admin-1'
    );
    expect(ctx.roles.setUserRoles).toHaveBeenCalledWith('u-9', ['user'], 'admin-1');
    expect(created.roles).toEqual(['user']);
  });

  it('409 si el email ya existe — sin crear nada ni auditar', async () => {
    const local = build({
      user: {
        findUnique: vi.fn().mockResolvedValue(GERENTE),
        create: vi.fn(),
        findUniqueOrThrow: vi.fn()
      }
    });
    await expect(
      local.service.create({ email: GERENTE.email, displayName: 'Otro', roles: [] })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(local.prisma.user.create).not.toHaveBeenCalled();
    expect(local.audit.log).not.toHaveBeenCalled();
  });

  it('da de baja el acceso (dev-login rechaza inactivos) y lo audita', async () => {
    const local = build({
      user: {
        findUnique: vi.fn().mockResolvedValue(GERENTE),
        update: vi.fn().mockResolvedValue({ ...GERENTE, isActive: false }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...GERENTE, isActive: false })
      }
    });
    const updated = await local.service.setActive('u-9', false, 'admin-1');
    expect(local.prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u-9' }, data: { isActive: false } });
    expect(local.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'core.user_deactivated', entityId: 'u-9' })
    );
    expect(updated.isActive).toBe(false);
  });

  it('cambiar al estado que ya tiene no escribe ni audita (idempotente)', async () => {
    const local = build({
      user: {
        findUnique: vi.fn().mockResolvedValue(GERENTE),
        update: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue(GERENTE)
      }
    });
    const updated = await local.service.setActive('u-9', true);
    expect(local.prisma.user.update).not.toHaveBeenCalled();
    expect(local.audit.log).not.toHaveBeenCalled();
    expect(updated.isActive).toBe(true);
  });

  it('404 al activar/desactivar un usuario que no existe', async () => {
    await expect(ctx.service.setActive('u-nope', false)).rejects.toBeInstanceOf(NotFoundException);
  });
});
