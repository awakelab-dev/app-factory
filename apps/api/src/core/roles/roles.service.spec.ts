import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { RolesService } from './roles.service';

const USER = {
  id: 'u-1',
  email: 'admin@awakelab.dev',
  displayName: 'Admin',
  isActive: true,
  createdAt: new Date('2026-08-17T10:00:00.000Z'),
  roles: [{ role: { name: 'admin' } }]
};

function build(overrides: Record<string, unknown> = {}) {
  const prisma = {
    role: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'r-1', name: 'empleado', description: 'x', _count: { users: 2 } },
        { id: 'r-2', name: 'recepcion', description: 'y', _count: { users: 0 } }
      ])
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(USER),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        ...USER,
        roles: [{ role: { name: 'empleado' } }, { role: { name: 'recepcion' } }]
      })
    },
    userRole: {
      findMany: vi.fn().mockResolvedValue([{ role: { name: 'admin' } }]),
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    $transaction: vi.fn().mockResolvedValue([]),
    ...overrides
  };
  const audit = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  return { service: new RolesService(prisma as never, audit), prisma, audit };
}

describe('RolesService (asignación de roles sin SQL, incremento D bloque 2)', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('lista los roles con cuántos usuarios los tienen', async () => {
    expect(await ctx.service.list()).toEqual([
      { name: 'empleado', description: 'x', usersCount: 2 },
      { name: 'recepcion', description: 'y', usersCount: 0 }
    ]);
  });

  it('reemplaza el conjunto de roles (borra los que ya no están, crea los nuevos) y audita el antes/después', async () => {
    const updated = await ctx.service.setUserRoles('u-1', ['empleado', 'recepcion'], 'actor-1');
    expect(updated.roles).toEqual(['empleado', 'recepcion']);
    expect(ctx.prisma.$transaction).toHaveBeenCalledOnce();
    expect(ctx.prisma.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', roleId: { notIn: ['r-1', 'r-2'] } }
    });
    expect(ctx.prisma.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u-1', roleId: 'r-1' }, { userId: 'u-1', roleId: 'r-2' }],
      skipDuplicates: true
    });
    expect(ctx.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'core.user_roles_changed',
        actorId: 'actor-1',
        entityId: 'u-1',
        metadata: { before: ['admin'], after: ['empleado', 'recepcion'] }
      })
    );
  });

  it('404 si el usuario no existe — sin tocar nada', async () => {
    const local = build({ user: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(local.service.setUserRoles('u-9', ['empleado'])).rejects.toBeInstanceOf(NotFoundException);
    expect(local.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('400 con el nombre exacto si se pide un rol que no existe (no lo crea al vuelo)', async () => {
    await expect(ctx.service.setUserRoles('u-1', ['empleado', 'inventado'])).rejects.toThrow(/inventado/);
    await expect(ctx.service.setUserRoles('u-1', ['inventado'])).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lista vacía = quitar todos los roles del usuario', async () => {
    const local = build({
      role: { findMany: vi.fn().mockResolvedValue([]) },
      user: {
        findUnique: vi.fn().mockResolvedValue(USER),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...USER, roles: [] })
      }
    });
    const updated = await local.service.setUserRoles('u-1', []);
    expect(updated.roles).toEqual([]);
    expect(local.prisma.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', roleId: { notIn: [] } }
    });
  });
});
