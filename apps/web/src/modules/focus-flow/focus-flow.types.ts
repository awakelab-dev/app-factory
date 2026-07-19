import { z } from 'zod';

/**
 * Contratos de `focus-flow` en el lado web — espejo deliberado de
 * `apps/api/src/modules/focus-flow/focus-flow.types.ts` (mismo motivo que
 * `gestor-proyectos.types.ts`: este módulo se genera con aislamiento
 * estricto de carpeta y no puede tocar `@awk/types`). Los tipos de REQUEST
 * son interfaces TS simples, sin Zod, porque `apiFetch` nunca valida lo que
 * se envía.
 */

export const focusSessionPhaseSchema = z.enum(['focus', 'short_break', 'long_break']);
export type FocusSessionPhase = z.infer<typeof focusSessionPhaseSchema>;

export const focusSettingsSchema = z.object({
  id: z.string(),
  focusMinutes: z.number().int(),
  shortBreakMinutes: z.number().int(),
  longBreakMinutes: z.number().int(),
  roundsBeforeLongBreak: z.number().int(),
  autoStartBreaks: z.boolean(),
  autoStartFocus: z.boolean(),
  notificationsEnabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});
export type FocusSettings = z.infer<typeof focusSettingsSchema>;

export interface UpdateFocusSettingsRequest {
  focusMinutes?: number;
  shortBreakMinutes?: number;
  longBreakMinutes?: number;
  roundsBeforeLongBreak?: number;
  autoStartBreaks?: boolean;
  autoStartFocus?: boolean;
  notificationsEnabled?: boolean;
}

export const focusTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  estimatedPomodoros: z.number().int(),
  completedPomodoros: z.number().int(),
  done: z.boolean(),
  position: z.number().int(),
  taskDate: z.string(),
  sourceProyectosTaskId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});
export type FocusTask = z.infer<typeof focusTaskSchema>;
export const focusTasksResponseSchema = z.array(focusTaskSchema);

export interface CreateFocusTaskRequest {
  title: string;
  estimatedPomodoros: number;
  taskDate?: string;
}

export interface UpdateFocusTaskRequest {
  title?: string;
  estimatedPomodoros?: number;
  done?: boolean;
  position?: number;
}

export const importFocusTasksResponseSchema = z.object({
  imported: z.array(focusTaskSchema),
  skippedAlreadyImported: z.number().int()
});
export type ImportFocusTasksResponse = z.infer<typeof importFocusTasksResponseSchema>;

export const focusSessionSchema = z.object({
  id: z.string(),
  taskId: z.string().nullable(),
  phase: focusSessionPhaseSchema,
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  durationSeconds: z.number().int(),
  wasSkipped: z.boolean(),
  createdAt: z.iso.datetime()
});
export type FocusSession = z.infer<typeof focusSessionSchema>;

export interface CreateFocusSessionRequest {
  taskId?: string;
  phase: FocusSessionPhase;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  wasSkipped: boolean;
}

export const focusHourlyBucketSchema = z.object({ hour: z.number().int(), minutes: z.number() });
export type FocusHourlyBucket = z.infer<typeof focusHourlyBucketSchema>;

export const focusDashboardSchema = z.object({
  pomodorosCompletedToday: z.number().int(),
  focusMinutesToday: z.number(),
  tasksCompletedToday: z.number().int(),
  tasksInProgressToday: z.number().int(),
  tasksPendingToday: z.number().int(),
  hourlyDistribution: z.array(focusHourlyBucketSchema)
});
export type FocusDashboard = z.infer<typeof focusDashboardSchema>;

export const focusPerformanceRangeSchema = z.enum(['week', 'month']);
export type FocusPerformanceRange = z.infer<typeof focusPerformanceRangeSchema>;

export const focusPerformancePointSchema = z.object({
  label: z.string(),
  pomodorosCompleted: z.number().int(),
  tasksCompletionRatePct: z.number(),
  effectiveFocusPct: z.number()
});
export type FocusPerformancePoint = z.infer<typeof focusPerformancePointSchema>;

export const focusPerformanceSchema = z.object({
  range: focusPerformanceRangeSchema,
  points: z.array(focusPerformancePointSchema),
  streakDays: z.number().int(),
  averagePomodorosPerDay: z.number()
});
export type FocusPerformance = z.infer<typeof focusPerformanceSchema>;
