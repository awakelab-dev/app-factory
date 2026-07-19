import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { PrismaService } from '../../prisma/prisma.service';
import { FocusSessionsService } from './focus-flow-sessions.service';

const owner: AuthUser = { id: 'u-1', email: 'a@awakelab.dev', displayName: 'Ana', roles: ['user'] };
const stranger: AuthUser = { id: 'u-2', email: 'b@awakelab.dev', displayName: 'Beto', roles: ['user'] };

const task = { id: 't-1', userId: 'u-1', estimatedPomodoros: 3, completedPomodoros: 1 };

const sessionRow = {
  id: 'sess-1',
  taskId: 't-1',
  phase: 'focus' as const,
  startedAt: new Date('2026-07-19T10:00:00.000Z'),
  completedAt: new Date('2026-07-19T10:25:00.000Z'),
  durationSeconds: 1500,
  wasSkipped: false,
  createdAt: new Date('2026-07-19T10:25:00.000Z')
};

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma: Record<string, unknown> = {
    focusTask: { findUnique: vi.fn().mockResolvedValue(task), update: vi.fn().mockResolvedValue(task) },
    focusSession: { create: vi.fn().mockResolvedValue(sessionRow) },
    ...overrides
  };
  prisma.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(prisma));
  return { service: new FocusSessionsService(prisma as unknown as PrismaService), prisma: prisma as unknown as PrismaService };
}

const baseDto = {
  taskId: 't-1',
  phase: 'focus' as const,
  startedAt: '2026-07-19T10:00:00.000Z',
  completedAt: '2026-07-19T10:25:00.000Z',
  durationSeconds: 1500,
  wasSkipped: false
};

describe('FocusSessionsService.create', () => {
  it('lanza NotFound si la tarea no existe o es de otra persona', async () => {
    const { service } = buildService();
    await expect(service.create(stranger, baseDto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un foco completado con tarea incrementa completedPomodoros (tope en el estimado)', async () => {
    const { service, prisma } = buildService();
    await service.create(owner, baseDto);
    expect(prisma.focusTask.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { completedPomodoros: 2 }
    });
  });

  it('nunca supera el estimado (Math.min con el tope)', async () => {
    const { service, prisma } = buildService({
      focusTask: {
        findUnique: vi.fn().mockResolvedValue({ ...task, completedPomodoros: 3 }),
        update: vi.fn().mockResolvedValue(task)
      }
    });
    await service.create(owner, baseDto);
    expect(prisma.focusTask.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { completedPomodoros: 3 }
    });
  });

  it('saltar una fase de enfoque NUNCA cuenta como pomodoro completado', async () => {
    const { service, prisma } = buildService();
    await service.create(owner, { ...baseDto, wasSkipped: true });
    expect(prisma.focusTask.update).not.toHaveBeenCalled();
  });

  it('una fase sin tarea (descanso) no toca focusTask', async () => {
    const { service, prisma } = buildService();
    await service.create(owner, { ...baseDto, taskId: undefined, phase: 'short_break' });
    expect(prisma.focusTask.update).not.toHaveBeenCalled();
    expect(prisma.focusSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ taskId: null, phase: 'short_break' }) })
    );
  });
});
