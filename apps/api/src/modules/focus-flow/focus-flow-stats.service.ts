import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays, formatDateOnly, startOfDay } from './focus-flow-dates';
import type { FocusDashboard, FocusPerformance, FocusPerformanceRange } from './focus-flow.types';

/** Cuántos días hacia atrás se buscan para calcular la racha — no es un
 * límite de producto, solo evita una consulta sin cota (una racha real de
 * meses es posible pero rarísima; con 120 días de margen sobra). */
const STREAK_LOOKBACK_DAYS = 120;
/** `week` → 7 puntos diarios; `month` → 4 puntos semanales ("4 semanas" de
 * la spec funcional/técnica, ver "Desempeño"). */
const RANGE_DAYS: Record<FocusPerformanceRange, number> = { week: 7, month: 28 };
const BUCKET_SIZE_DAYS: Record<FocusPerformanceRange, number> = { week: 1, month: 7 };

/**
 * Dashboard y desempeño calculados SOLO de `focus.sessions`/`focus.tasks`
 * reales (gate funcional, decisión 5 — prohibido cualquier número
 * hardcodeado del prototipo). Volumen esperado (datos personales de un solo
 * usuario) es pequeño: se agrega en memoria tras un `findMany` acotado por
 * fecha, sin necesidad de `groupBy` de Postgres.
 */
@Injectable()
export class FocusStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: AuthUser): Promise<FocusDashboard> {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);

    const [sessionsToday, tasksToday] = await Promise.all([
      this.prisma.focusSession.findMany({
        where: { userId: user.id, completedAt: { gte: today, lt: tomorrow } },
        select: { phase: true, startedAt: true, durationSeconds: true, wasSkipped: true }
      }),
      this.prisma.focusTask.findMany({
        where: { userId: user.id, taskDate: today },
        select: { done: true, completedPomodoros: true }
      })
    ]);

    const completedFocusToday = sessionsToday.filter((s) => s.phase === 'focus' && !s.wasSkipped);
    const focusMinutesToday =
      Math.round((completedFocusToday.reduce((acc, s) => acc + s.durationSeconds, 0) / 60) * 10) / 10;

    const tasksCompletedToday = tasksToday.filter((t) => t.done).length;
    const tasksInProgressToday = tasksToday.filter((t) => !t.done && t.completedPomodoros > 0).length;
    const tasksPendingToday = tasksToday.length - tasksCompletedToday - tasksInProgressToday;

    const minutesByHour = new Array<number>(24).fill(0);
    for (const session of completedFocusToday) {
      const hour = session.startedAt.getUTCHours();
      minutesByHour[hour] = (minutesByHour[hour] ?? 0) + session.durationSeconds / 60;
    }

    return {
      pomodorosCompletedToday: completedFocusToday.length,
      focusMinutesToday,
      tasksCompletedToday,
      tasksInProgressToday,
      tasksPendingToday,
      hourlyDistribution: minutesByHour.map((minutes, hour) => ({ hour, minutes: Math.round(minutes * 10) / 10 }))
    };
  }

  async performance(user: AuthUser, range: FocusPerformanceRange): Promise<FocusPerformance> {
    const today = startOfDay(new Date());
    const rangeDays = RANGE_DAYS[range];
    const bucketSizeDays = BUCKET_SIZE_DAYS[range];
    // La racha necesita mirar más atrás que el rango de puntos visibles.
    const lookbackDays = Math.max(rangeDays, STREAK_LOOKBACK_DAYS);
    const lookbackStart = addDays(today, -(lookbackDays - 1));

    const [sessions, tasks] = await Promise.all([
      this.prisma.focusSession.findMany({
        where: { userId: user.id, phase: 'focus', completedAt: { gte: lookbackStart, lt: addDays(today, 1) } },
        select: { completedAt: true, wasSkipped: true }
      }),
      this.prisma.focusTask.findMany({
        where: { userId: user.id, taskDate: { gte: lookbackStart, lte: today } },
        select: { taskDate: true, done: true }
      })
    ]);

    const streakDays = this.computeStreak(today, sessions);
    const points = this.computePoints(today, rangeDays, bucketSizeDays, sessions, tasks);

    const totalPomodoros = points.reduce((acc, p) => acc + p.pomodorosCompleted, 0);
    const averagePomodorosPerDay = Math.round((totalPomodoros / rangeDays) * 10) / 10;

    return { range, points, streakDays, averagePomodorosPerDay };
  }

  /** Días consecutivos (desde hoy hacia atrás) con >=1 sesión de enfoque
   * completada — gate técnico, decisión 4. Se detiene en el primer hueco. */
  private computeStreak(today: Date, sessions: Array<{ completedAt: Date; wasSkipped: boolean }>): number {
    const completedDays = new Set(
      sessions.filter((s) => !s.wasSkipped).map((s) => formatDateOnly(startOfDay(s.completedAt)))
    );

    let streak = 0;
    for (let cursor = today; completedDays.has(formatDateOnly(cursor)); cursor = addDays(cursor, -1)) {
      streak += 1;
    }
    return streak;
  }

  private computePoints(
    today: Date,
    rangeDays: number,
    bucketSizeDays: number,
    sessions: Array<{ completedAt: Date; wasSkipped: boolean }>,
    tasks: Array<{ taskDate: Date; done: boolean }>
  ): FocusPerformance['points'] {
    const bucketCount = rangeDays / bucketSizeDays;
    const points: FocusPerformance['points'] = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const bucketEnd = addDays(today, -i * bucketSizeDays);
      const bucketStart = addDays(bucketEnd, -(bucketSizeDays - 1));
      const inBucket = (day: Date) => day.getTime() >= bucketStart.getTime() && day.getTime() <= bucketEnd.getTime();

      const bucketSessions = sessions.filter((s) => inBucket(startOfDay(s.completedAt)));
      const bucketTasks = tasks.filter((t) => inBucket(startOfDay(t.taskDate)));

      const completed = bucketSessions.filter((s) => !s.wasSkipped).length;
      const skipped = bucketSessions.length - completed;
      const effectiveFocusPct = completed + skipped === 0 ? 0 : (completed / (completed + skipped)) * 100;
      const tasksCompletionRatePct =
        bucketTasks.length === 0 ? 0 : (bucketTasks.filter((t) => t.done).length / bucketTasks.length) * 100;

      points.push({
        label:
          bucketSizeDays === 1
            ? formatDateOnly(bucketEnd)
            : `${formatDateOnly(bucketStart)} → ${formatDateOnly(bucketEnd)}`,
        pomodorosCompleted: completed,
        tasksCompletionRatePct: Math.round(tasksCompletionRatePct * 10) / 10,
        effectiveFocusPct: Math.round(effectiveFocusPct * 10) / 10
      });
    }

    return points;
  }
}
