import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { PrismaService } from '../../prisma/prisma.service';
import { GestorPermissionsService } from './gestor-proyectos-permissions.service';

const admin: AuthUser = { id: 'u-admin', email: 'a@awakelab.dev', displayName: 'Admin', roles: ['admin'] };
const assignee: AuthUser = { id: 'u-assignee', email: 'b@awakelab.dev', displayName: 'Asignado', roles: ['user'] };
const stranger: AuthUser = { id: 'u-stranger', email: 'c@awakelab.dev', displayName: 'Otro', roles: ['user'] };

const selfAssignedTask = { assigneeId: 'u-assignee', createdById: 'u-assignee' };
const adminAssignedTask = { assigneeId: 'u-assignee', createdById: 'u-admin' };

function buildService(taskFindFirstResult: unknown = null) {
  const prisma = {
    task: { findFirst: vi.fn().mockResolvedValue(taskFindFirstResult) }
  } as unknown as PrismaService;
  return { service: new GestorPermissionsService(prisma), prisma };
}

describe('GestorPermissionsService.canChangeStatus / canAddInfo', () => {
  it('el admin siempre puede', () => {
    const { service } = buildService();
    expect(service.canChangeStatus(admin, selfAssignedTask)).toBe(true);
    expect(service.canAddInfo(admin, adminAssignedTask)).toBe(true);
  });

  it('el asignado puede', () => {
    const { service } = buildService();
    expect(service.canChangeStatus(assignee, adminAssignedTask)).toBe(true);
  });

  it('un tercero no puede', () => {
    const { service } = buildService();
    expect(service.canChangeStatus(stranger, adminAssignedTask)).toBe(false);
    expect(service.canAddInfo(stranger, adminAssignedTask)).toBe(false);
  });
});

describe('GestorPermissionsService.canEditTask / canDeleteTask', () => {
  it('el admin siempre puede', () => {
    const { service } = buildService();
    expect(service.canEditTask(admin, adminAssignedTask)).toBe(true);
  });

  it('quien creó Y sigue asignada a sí misma puede editar/eliminar', () => {
    const { service } = buildService();
    expect(service.canEditTask(assignee, selfAssignedTask)).toBe(true);
    expect(service.canDeleteTask(assignee, selfAssignedTask)).toBe(true);
  });

  it('un ejecutor NO puede editar/eliminar una tarea que le asignó un admin (solo la creó el admin)', () => {
    const { service } = buildService();
    expect(service.canEditTask(assignee, adminAssignedTask)).toBe(false);
    expect(service.canDeleteTask(assignee, adminAssignedTask)).toBe(false);
  });

  it('si ya no está asignada a quien la creó, tampoco puede (se la reasignaron)', () => {
    const { service } = buildService();
    const reassigned = { assigneeId: 'u-stranger', createdById: 'u-assignee' };
    expect(service.canEditTask(assignee, reassigned)).toBe(false);
  });
});

describe('GestorPermissionsService.participatesIn', () => {
  it('el admin participa siempre, sin consultar la base', async () => {
    const { service, prisma } = buildService();
    expect(await service.participatesIn(admin, 'p-1')).toBe(true);
    expect(prisma.task.findFirst).not.toHaveBeenCalled();
  });

  it('un no-admin participa si tiene alguna tarea asignada en el proyecto', async () => {
    const { service, prisma } = buildService({ id: 't-1' });
    expect(await service.participatesIn(assignee, 'p-1')).toBe(true);
    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 'p-1', assigneeId: 'u-assignee' } })
    );
  });

  it('un no-admin sin tareas asignadas en el proyecto no participa', async () => {
    const { service } = buildService(null);
    expect(await service.participatesIn(stranger, 'p-1')).toBe(false);
  });
});
