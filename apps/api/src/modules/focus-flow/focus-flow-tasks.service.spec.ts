import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { AuditService } from '../../core/audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { FocusTasksService } from './focus-flow-tasks.service';

const owner: AuthUser = { id: 'u-1', email: 'a@awakelab.dev', displayName: 'Ana', roles: ['user'] };
const stranger: AuthUser = { id: 'u-2', email: 'b@awakelab.dev', displayName: 'Beto', roles: ['user'] };

const TODAY = new Date('2026-07-19T00:00:00.000Z');

const baseTask = {
  id: 't-1',
  userId: 'u-1',
  title: 'Escribir informe',
  estimatedPomodoros: 3,
  completedPomodoros: 0,
  done: false,
  position: 0,
  taskDate: TODAY,
  sourceProyectosTaskId: null,
  createdAt: TODAY,
  updatedAt: TODAY
};

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    focusTask: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(baseTask),
      create: vi.fn().mockResolvedValue(baseTask),
      update: vi.fn().mockResolvedValue(baseTask),
      delete: vi.fn().mockResolvedValue(undefined)
    },
    task: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : (arg as () => unknown)())),
    ...overrides
  } as unknown as PrismaService;

  const audit = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  return { service: new FocusTasksService(prisma, audit), prisma, audit };
}

describe('FocusTasksService.listForDate', () => {
  it('usa "hoy" (medianoche UTC) si no se pasa fecha', async () => {
    const { service, prisma } = buildService();
    await service.listForDate(owner);
    expect(prisma.focusTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u-1' }) })
    );
  });
});

describe('FocusTasksService.createTask', () => {
  it('la posición es la última+1 del día (se añade al final de la cola)', async () => {
    const { service, prisma } = buildService({
      focusTask: {
        findFirst: vi.fn().mockResolvedValue({ position: 4 }),
        create: vi.fn().mockResolvedValue({ ...baseTask, position: 5 })
      }
    });
    await service.createTask(owner, { title: 'Nueva', estimatedPomodoros: 1 });
    expect(prisma.focusTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ position: 5, userId: 'u-1' }) })
    );
  });

  it('si no hay tareas ese día, la posición es 0', async () => {
    const { service, prisma } = buildService();
    await service.createTask(owner, { title: 'Primera', estimatedPomodoros: 1 });
    expect(prisma.focusTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ position: 0 }) })
    );
  });
});

describe('FocusTasksService — aislamiento por fila (requireOwnTask)', () => {
  it('updateTask lanza NotFound (no Forbidden) si la tarea es de otra persona', async () => {
    const { service } = buildService();
    await expect(service.updateTask(stranger, 't-1', { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deleteTask lanza NotFound si la tarea no existe', async () => {
    const { service } = buildService({ focusTask: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(service.deleteTask(owner, 't-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deleteTask del dueño real elimina y audita', async () => {
    const { service, prisma, audit } = buildService();
    await service.deleteTask(owner, 't-1');
    expect(prisma.focusTask.delete).toHaveBeenCalledWith({ where: { id: 't-1' } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'focus_flow.task_deleted' }));
  });
});

describe('FocusTasksService.updateTask — reordenar (position)', () => {
  it('renumera las tareas del día a 0..n-1 en una transacción', async () => {
    const { service, prisma } = buildService({
      focusTask: {
        findUnique: vi.fn().mockResolvedValue(baseTask),
        findMany: vi.fn().mockResolvedValue([{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }]),
        update: vi.fn().mockResolvedValue(baseTask)
      }
    });

    await service.updateTask(owner, 't-1', { position: 2 });

    expect(prisma.$transaction).toHaveBeenCalled();
    // t-1 se mueve al final: orden esperado t-2, t-3, t-1 → posiciones 0,1,2
    expect(prisma.focusTask.update).toHaveBeenCalledWith({ where: { id: 't-2' }, data: { position: 0 } });
    expect(prisma.focusTask.update).toHaveBeenCalledWith({ where: { id: 't-3' }, data: { position: 1 } });
    expect(prisma.focusTask.update).toHaveBeenCalledWith({ where: { id: 't-1' }, data: { position: 2 } });
  });
});

describe('FocusTasksService.importFromProyectos', () => {
  it('sin tareas asignadas en proyectos, no importa nada', async () => {
    const { service, prisma } = buildService();
    const result = await service.importFromProyectos(owner);
    expect(result).toEqual({ imported: [], skippedAlreadyImported: 0 });
    expect(prisma.focusTask.create).not.toHaveBeenCalled();
  });

  it('excluye status "finalizada" en la query a proyectos.tasks (solo lectura)', async () => {
    const { service, prisma } = buildService();
    await service.importFromProyectos(owner);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { assigneeId: 'u-1', status: { not: 'finalizada' } } })
    );
  });

  it('no reimporta una tarea con el mismo sourceProyectosTaskId', async () => {
    const { service, prisma } = buildService({
      task: { findMany: vi.fn().mockResolvedValue([{ id: 'p-1', title: 'Ya importada' }]) },
      focusTask: {
        findMany: vi.fn().mockResolvedValue([{ sourceProyectosTaskId: 'p-1' }]),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn()
      }
    });

    const result = await service.importFromProyectos(owner);
    expect(result).toEqual({ imported: [], skippedAlreadyImported: 1 });
    expect(prisma.focusTask.create).not.toHaveBeenCalled();
  });

  it('importa las tareas nuevas al final de la cola de hoy y audita', async () => {
    const { service, prisma, audit } = buildService({
      task: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p-1', title: 'Tarea A' },
          { id: 'p-2', title: 'Tarea B' }
        ])
      },
      focusTask: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ position: 0 }),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...baseTask, ...data }))
      }
    });

    const result = await service.importFromProyectos(owner);

    expect(prisma.focusTask.create).toHaveBeenCalledTimes(2);
    expect(prisma.focusTask.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ sourceProyectosTaskId: 'p-1', position: 1 }) })
    );
    expect(prisma.focusTask.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ sourceProyectosTaskId: 'p-2', position: 2 }) })
    );
    expect(result.imported).toHaveLength(2);
    expect(result.skippedAlreadyImported).toBe(0);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'focus_flow.tasks_imported_from_proyectos', metadata: { count: 2 } })
    );
  });
});
