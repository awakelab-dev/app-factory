import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { AuditService } from '../../core/audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { GestorPermissionsService } from './gestor-proyectos-permissions.service';
import { GestorTasksService } from './gestor-proyectos-tasks.service';

const admin: AuthUser = { id: 'u-admin', email: 'a@awakelab.dev', displayName: 'Admin', roles: ['admin'] };
const assignee: AuthUser = { id: 'u-1', email: 'b@awakelab.dev', displayName: 'Ejecutor', roles: ['user'] };
const stranger: AuthUser = { id: 'u-2', email: 'c@awakelab.dev', displayName: 'Otro', roles: ['user'] };

const baseTask = {
  id: 't-1',
  projectId: 'p-1',
  sprintId: 's-1',
  title: 'Tarea',
  status: 'iniciada',
  dueDate: new Date('2026-07-24'),
  assigneeId: 'u-1',
  createdById: 'u-1',
  createdAt: new Date('2026-07-20'),
  updatedAt: new Date('2026-07-20'),
  subtasks: [],
  comments: []
};

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    sprint: { findUnique: vi.fn().mockResolvedValue({ id: 's-1', projectId: 'p-1' }) },
    task: {
      findUnique: vi.fn().mockResolvedValue(baseTask),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      groupBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0)
    },
    subtask: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    comment: { create: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides
  } as unknown as PrismaService;

  const audit = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const permissions = new GestorPermissionsService(prisma);
  return { service: new GestorTasksService(prisma, audit, permissions), prisma, audit };
}

describe('GestorTasksService.sprintKanban', () => {
  it('lanza NotFound si el sprint no existe', async () => {
    const { service } = buildService({ sprint: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(service.sprintKanban(assignee, 's-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza Forbidden si el usuario no participa en el proyecto del sprint', async () => {
    const { service } = buildService();
    await expect(service.sprintKanban(stranger, 's-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el admin siempre ve el tablero', async () => {
    const { service } = buildService({ task: { findMany: vi.fn().mockResolvedValue([baseTask]) } });
    const rows = await service.sprintKanban(admin, 's-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.permissions.canDeleteTask).toBe(true);
  });
});

describe('GestorTasksService.createTask', () => {
  it('fuerza assigneeId al propio requester si no es admin, aunque venga otro en el body', async () => {
    const { service, prisma } = buildService({
      task: { create: vi.fn().mockResolvedValue({ ...baseTask, assigneeId: 'u-1' }) }
    });

    await service.createTask(assignee, { sprintId: 's-1', title: 'X', dueDate: '2026-07-24', assigneeId: 'u-admin' });

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assigneeId: 'u-1' }) })
    );
  });

  it('exige assigneeId cuando el requester es admin', async () => {
    const { service } = buildService();
    await expect(
      service.createTask(admin, { sprintId: 's-1', title: 'X', dueDate: '2026-07-24' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lanza NotFound si el sprint no existe', async () => {
    const { service } = buildService({ sprint: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(
      service.createTask(assignee, { sprintId: 's-x', title: 'X', dueDate: '2026-07-24' })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('GestorTasksService.updateStatus (canChangeStatus)', () => {
  it('el asignado puede cambiar el estado', async () => {
    const { service, prisma, audit } = buildService({
      task: { findUnique: vi.fn().mockResolvedValue(baseTask), update: vi.fn().mockResolvedValue(baseTask) }
    });
    await service.updateStatus(assignee, 't-1', { status: 'en_progreso' });
    expect(prisma.task.update).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'gestor_proyectos.task_status_changed' })
    );
  });

  it('un tercero no puede cambiar el estado', async () => {
    const { service } = buildService();
    await expect(service.updateStatus(stranger, 't-1', { status: 'en_progreso' })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});

describe('GestorTasksService.updateTask / deleteTask (canEditTask/canDeleteTask)', () => {
  const adminAssignedTask = { ...baseTask, assigneeId: 'u-1', createdById: 'u-admin' };

  it('un ejecutor NO puede editar una tarea que le asignó el admin', async () => {
    const { service } = buildService({ task: { findUnique: vi.fn().mockResolvedValue(adminAssignedTask) } });
    await expect(service.updateTask(assignee, 't-1', { title: 'Nuevo' })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('un ejecutor SÍ puede editar/eliminar una tarea que se auto-asignó', async () => {
    const selfTask = { ...baseTask, assigneeId: 'u-1', createdById: 'u-1' };
    const { service, prisma } = buildService({
      task: { findUnique: vi.fn().mockResolvedValue(selfTask), update: vi.fn().mockResolvedValue(selfTask), delete: vi.fn() }
    });
    await service.updateTask(assignee, 't-1', { title: 'Nuevo título' });
    expect(prisma.task.update).toHaveBeenCalled();
    await service.deleteTask(assignee, 't-1');
    expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 't-1' } });
  });

  it('el admin puede editar/eliminar cualquier tarea', async () => {
    const { service, prisma } = buildService({
      task: {
        findUnique: vi.fn().mockResolvedValue(adminAssignedTask),
        update: vi.fn().mockResolvedValue(adminAssignedTask),
        delete: vi.fn()
      }
    });
    await service.updateTask(admin, 't-1', { title: 'Nuevo' });
    await service.deleteTask(admin, 't-1');
    expect(prisma.task.update).toHaveBeenCalled();
    expect(prisma.task.delete).toHaveBeenCalled();
  });

  it('reasignar (assigneeId) es SOLO admin — un ejecutor no puede aunque pueda editar la tarea (nota de gate)', async () => {
    const selfTask = { ...baseTask, assigneeId: 'u-1', createdById: 'u-1' };
    const { service } = buildService({ task: { findUnique: vi.fn().mockResolvedValue(selfTask) } });
    await expect(service.updateTask(assignee, 't-1', { assigneeId: 'u-2' })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('el admin sí puede reasignar una tarea', async () => {
    const { service, prisma } = buildService({
      task: { findUnique: vi.fn().mockResolvedValue(adminAssignedTask), update: vi.fn().mockResolvedValue(adminAssignedTask) }
    });
    await service.updateTask(admin, 't-1', { assigneeId: 'u-2' });
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assigneeId: 'u-2' }) })
    );
  });
});

describe('GestorTasksService subtareas y comentarios (canAddInfo)', () => {
  it('el asignado puede añadir subtareas y comentarios', async () => {
    const { service, prisma } = buildService({
      subtask: { create: vi.fn().mockResolvedValue({ id: 'sub-1', taskId: 't-1', title: 'X', done: false, createdAt: new Date() }) },
      comment: { create: vi.fn().mockResolvedValue({ id: 'c-1', taskId: 't-1', authorId: 'u-1', text: 'hola', createdAt: new Date() }) }
    });
    await service.addSubtask(assignee, 't-1', { title: 'Subtarea' });
    await service.addComment(assignee, 't-1', { text: 'hola' });
    expect(prisma.subtask.create).toHaveBeenCalled();
    expect(prisma.comment.create).toHaveBeenCalled();
  });

  it('un tercero no puede añadir subtareas ni comentarios', async () => {
    const { service } = buildService();
    await expect(service.addSubtask(stranger, 't-1', { title: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.addComment(stranger, 't-1', { text: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('toggleSubtask revalida el permiso de la tarea dueña, no solo que exista la subtarea', async () => {
    const { service } = buildService({
      subtask: { findUnique: vi.fn().mockResolvedValue({ id: 'sub-1', taskId: 't-1' }) }
    });
    await expect(service.toggleSubtask(stranger, 'sub-1', true)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('GestorTasksService.dashboard', () => {
  it('no-admin: acota el scope de KPIs a sus propias tareas asignadas', async () => {
    const { service, prisma } = buildService({
      task: {
        groupBy: vi.fn().mockResolvedValue([{ status: 'iniciada', _count: { _all: 1 } }]),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([])
      }
    });

    const dashboard = await service.dashboard(assignee);

    expect(prisma.task.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { assigneeId: 'u-1' } })
    );
    expect(dashboard.pendingTasks).toBe(1);
  });

  it('admin: sin filtro de assigneeId', async () => {
    const { service, prisma } = buildService();
    await service.dashboard(admin);
    expect(prisma.task.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});
