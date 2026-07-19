import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { PrismaService } from '../../prisma/prisma.service';
import { addDays, formatDateOnly, startOfDay } from './focus-flow-dates';
import { FocusStatsService } from './focus-flow-stats.service';

const user: AuthUser = { id: 'u-1', email: 'a@awakelab.dev', displayName: 'Ana', roles: ['user'] };

// Fechas relativas a "ahora" (no absolutas, mismo criterio que
// gestor-proyectos-reports.service.spec.ts): el servicio calcula "hoy" con
// `new Date()` real, así que los fixtures se anclan a Date.now().
const today = startOfDay(new Date());

function buildService(sessions: unknown[], tasks: unknown[]) {
  const prisma = {
    focusSession: { findMany: vi.fn().mockResolvedValue(sessions) },
    focusTask: { findMany: vi.fn().mockResolvedValue(tasks) }
  } as unknown as PrismaService;
  return { service: new FocusStatsService(prisma), prisma };
}

describe('FocusStatsService.dashboard', () => {
  it('cuenta solo sesiones de enfoque completadas (no saltadas, no descansos) para KPIs y minutos', async () => {
    const sessions = [
      { phase: 'focus', startedAt: new Date(today.getTime() + 9 * 3_600_000), durationSeconds: 1500, wasSkipped: false },
      { phase: 'focus', startedAt: new Date(today.getTime() + 9 * 3_600_000), durationSeconds: 600, wasSkipped: true },
      { phase: 'short_break', startedAt: new Date(today.getTime() + 9 * 3_600_000), durationSeconds: 300, wasSkipped: false }
    ];
    const { service } = buildService(sessions, []);
    const dashboard = await service.dashboard(user);

    expect(dashboard.pomodorosCompletedToday).toBe(1);
    expect(dashboard.focusMinutesToday).toBe(25);
    expect(dashboard.hourlyDistribution).toHaveLength(24);
    expect(dashboard.hourlyDistribution[9]).toEqual({ hour: 9, minutes: 25 });
  });

  it('clasifica tareas en completadas/en curso/pendientes', async () => {
    const tasks = [
      { done: true, completedPomodoros: 3 },
      { done: false, completedPomodoros: 1 },
      { done: false, completedPomodoros: 0 }
    ];
    const { service } = buildService([], tasks);
    const dashboard = await service.dashboard(user);

    expect(dashboard.tasksCompletedToday).toBe(1);
    expect(dashboard.tasksInProgressToday).toBe(1);
    expect(dashboard.tasksPendingToday).toBe(1);
  });
});

describe('FocusStatsService.performance — racha (streakDays)', () => {
  it('cuenta días consecutivos desde hoy hacia atrás, se detiene en el primer hueco', async () => {
    const sessionOn = (daysAgo: number, skipped = false) => ({
      completedAt: addDays(today, -daysAgo),
      wasSkipped: skipped
    });
    // hoy, ayer, anteayer: racha de 3. Hace 3 días: hueco (no hay sesión).
    const sessions = [sessionOn(0), sessionOn(1), sessionOn(2)];
    const { service } = buildService(sessions, []);

    const performance = await service.performance(user, 'week');
    expect(performance.streakDays).toBe(3);
  });

  it('una sesión saltada no cuenta para la racha', async () => {
    const sessions = [{ completedAt: today, wasSkipped: true }];
    const { service } = buildService(sessions, []);
    const performance = await service.performance(user, 'week');
    expect(performance.streakDays).toBe(0);
  });
});

describe('FocusStatsService.performance — puntos y foco efectivo', () => {
  it('range=week produce 7 puntos diarios; range=month produce 4 puntos semanales', async () => {
    const { service } = buildService([], []);
    expect((await service.performance(user, 'week')).points).toHaveLength(7);
    expect((await service.performance(user, 'month')).points).toHaveLength(4);
  });

  it('foco efectivo = completadas / (completadas + saltadas) del bloque de hoy', async () => {
    const sessions = [
      { completedAt: today, wasSkipped: false },
      { completedAt: today, wasSkipped: false },
      { completedAt: today, wasSkipped: true }
    ];
    const { service } = buildService(sessions, []);
    const performance = await service.performance(user, 'week');
    const todayPoint = performance.points.find((p) => p.label === formatDateOnly(today));

    expect(todayPoint?.pomodorosCompleted).toBe(2);
    expect(todayPoint?.effectiveFocusPct).toBeCloseTo(66.7, 1);
  });

  it('tasa de finalización de tareas del bloque de hoy', async () => {
    const tasks = [
      { taskDate: today, done: true },
      { taskDate: today, done: false }
    ];
    const { service } = buildService([], tasks);
    const performance = await service.performance(user, 'week');
    const todayPoint = performance.points.find((p) => p.label === formatDateOnly(today));

    expect(todayPoint?.tasksCompletionRatePct).toBe(50);
  });
});
