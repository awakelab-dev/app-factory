import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { PrismaService } from '../../prisma/prisma.service';
import { FocusTimerStateService } from './focus-flow-timer-state.service';

const user: AuthUser = { id: 'u-1', email: 'a@awakelab.dev', displayName: 'Ana', roles: ['user'] };

const timerStateRow = {
  id: 'ts-1',
  userId: 'u-1',
  phase: 'focus' as const,
  round: 2,
  taskId: 't-1',
  phaseStartedAt: new Date('2026-07-19T10:00:00.000Z'),
  accumulatedSeconds: 120,
  running: true,
  updatedAt: new Date('2026-07-19T10:00:00.000Z')
};

function buildService() {
  const prisma = {
    focusTimerState: { findUnique: vi.fn(), upsert: vi.fn().mockResolvedValue(timerStateRow) }
  } as unknown as PrismaService;
  return { service: new FocusTimerStateService(prisma), prisma };
}

describe('FocusTimerStateService.get', () => {
  it('devuelve null si el usuario nunca corrió un timer (gate técnico change-2)', async () => {
    const { service, prisma } = buildService();
    vi.mocked(prisma.focusTimerState.findUnique).mockResolvedValue(null);

    const result = await service.get(user);

    expect(prisma.focusTimerState.findUnique).toHaveBeenCalledWith({ where: { userId: 'u-1' } });
    expect(result).toBeNull();
  });

  it('mapea la fila persistida a DTO cuando existe', async () => {
    const { service, prisma } = buildService();
    vi.mocked(prisma.focusTimerState.findUnique).mockResolvedValue(timerStateRow);

    const result = await service.get(user);

    expect(result).toEqual(
      expect.objectContaining({
        id: 'ts-1',
        phase: 'focus',
        round: 2,
        taskId: 't-1',
        accumulatedSeconds: 120,
        running: true,
        phaseStartedAt: '2026-07-19T10:00:00.000Z'
      })
    );
  });
});

describe('FocusTimerStateService.upsert', () => {
  it('hace upsert por userId con el estado completo (lazy-create)', async () => {
    const { service, prisma } = buildService();

    await service.upsert(user, {
      phase: 'short_break',
      round: 1,
      taskId: undefined,
      phaseStartedAt: null,
      accumulatedSeconds: 0,
      running: false
    });

    expect(prisma.focusTimerState.upsert).toHaveBeenCalledWith({
      where: { userId: 'u-1' },
      create: {
        userId: 'u-1',
        phase: 'short_break',
        round: 1,
        taskId: null,
        phaseStartedAt: null,
        accumulatedSeconds: 0,
        running: false
      },
      update: {
        phase: 'short_break',
        round: 1,
        taskId: null,
        phaseStartedAt: null,
        accumulatedSeconds: 0,
        running: false
      }
    });
  });

  it('convierte phaseStartedAt de ISO string a Date cuando está corriendo', async () => {
    const { service, prisma } = buildService();

    await service.upsert(user, {
      phase: 'focus',
      round: 3,
      taskId: 't-2',
      phaseStartedAt: '2026-07-19T09:00:00.000Z',
      accumulatedSeconds: 300,
      running: true
    });

    expect(prisma.focusTimerState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ phaseStartedAt: new Date('2026-07-19T09:00:00.000Z') }),
        update: expect.objectContaining({ phaseStartedAt: new Date('2026-07-19T09:00:00.000Z') })
      })
    );
  });
});
