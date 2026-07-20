import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { PrismaService } from '../../prisma/prisma.service';
import { addDays, formatDateOnly, startOfDay } from './focus-flow-dates';
import { FocusSettingsService } from './focus-flow-settings.service';
import { FocusStatsService } from './focus-flow-stats.service';

const user: AuthUser = { id: 'u-1', email: 'a@awakelab.dev', displayName: 'Ana', roles: ['user'] };

// Fechas relativas a "ahora" (no absolutas, mismo criterio que
// gestor-proyectos-reports.service.spec.ts): el servicio calcula "hoy" con
// `new Date()` real, así que los fixtures se anclan a Date.now().
const today = startOfDay(new Date());

/** Default 600 min (10 h) salvo que el test pida otra meta personal
 * (change-3: `performance()` lee `FocusSettingsService.getOrCreate`). */
function buildService(sessions: unknown[], tasks: unknown[], projectedFocusMinutesPerDay = 600) {
  const prisma = {
    focusSession: { findMany: vi.fn().mockResolvedValue(sessions) },
    focusTask: { findMany: vi.fn().mockResolvedValue(tasks) },
    focusSettings: {
      upsert: vi.fn().mockResolvedValue({
        id: 's-1',
        userId: user.id,
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        roundsBeforeLongBreak: 4,
        autoStartBreaks: true,
        autoStartFocus: false,
        notificationsEnabled: true,
        projectedFocusMinutesPerDay,
        createdAt: new Date('2026-07-01'),
        updatedAt: new Date('2026-07-01')
      })
    }
  } as unknown as PrismaService;
  const settingsService = new FocusSettingsService(prisma);
  return { service: new FocusStatsService(prisma, settingsService), prisma };
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

describe('FocusStatsService.performance — proyectadas vs. trabajadas (change-3)', () => {
  it('range=week: workedMinutes suma durationSeconds de sesiones no saltadas del día; projectedMinutes = meta × 1 día', async () => {
    const sessions = [
      { completedAt: today, wasSkipped: false, durationSeconds: 1500 }, // 25 min
      { completedAt: today, wasSkipped: false, durationSeconds: 900 }, // 15 min
      { completedAt: today, wasSkipped: true, durationSeconds: 1500 } // saltada: no cuenta
    ];
    const { service } = buildService(sessions, [], 600);
    const performance = await service.performance(user, 'week');
    const todayPoint = performance.points.find((p) => p.label === formatDateOnly(today));

    expect(todayPoint?.workedMinutes).toBe(40);
    expect(todayPoint?.projectedMinutes).toBe(600);
  });

  it('range=month: projectedMinutes = meta × 7 días del bloque semanal', async () => {
    const sessions = [{ completedAt: today, wasSkipped: false, durationSeconds: 3600 }]; // 60 min
    const { service } = buildService(sessions, [], 450); // meta personal: 7.5 h
    const performance = await service.performance(user, 'month');
    const lastPoint = performance.points.at(-1);

    expect(lastPoint?.workedMinutes).toBe(60);
    expect(lastPoint?.projectedMinutes).toBe(450 * 7);
  });

  it('sin sesiones, workedMinutes es 0 pero projectedMinutes refleja la meta igual', async () => {
    const { service } = buildService([], [], 600);
    const performance = await service.performance(user, 'week');

    expect(performance.points.every((p) => p.workedMinutes === 0)).toBe(true);
    expect(performance.points.every((p) => p.projectedMinutes === 600)).toBe(true);
  });
});
