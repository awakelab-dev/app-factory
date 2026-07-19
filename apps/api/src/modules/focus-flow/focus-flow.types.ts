import { z } from 'zod';

/**
 * Contratos (Zod) de `focus-flow`.
 *
 * NOTA sobre dónde viven estos esquemas (mismo criterio que
 * `gestor-proyectos.types.ts`): este módulo se genera con aislamiento
 * estricto de carpeta (docs/04, paso 4: "Solo puede tocar las carpetas de su
 * módulo") — no puede tocar `packages/types`, punto de integración
 * compartido entre módulos generados en paralelo. Los esquemas quedan, por
 * tanto, LOCALES a este módulo (aquí y en su espejo
 * `apps/web/.../focus-flow.types.ts`); unificar en `@awk/types`, si se
 * decide, es tarea de un paso posterior del pipeline.
 */

export const focusSessionPhaseSchema = z.enum(['focus', 'short_break', 'long_break']);
export type FocusSessionPhase = z.infer<typeof focusSessionPhaseSchema>;

// ---------------------------------------------------------------------------
// Configuración (una fila por usuario, creada perezosamente en el primer GET)
// ---------------------------------------------------------------------------

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

export const updateFocusSettingsRequestSchema = z.object({
  focusMinutes: z.number().int().min(1).max(180).optional(),
  shortBreakMinutes: z.number().int().min(1).max(60).optional(),
  longBreakMinutes: z.number().int().min(1).max(90).optional(),
  roundsBeforeLongBreak: z.number().int().min(1).max(12).optional(),
  autoStartBreaks: z.boolean().optional(),
  autoStartFocus: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional()
});
export type UpdateFocusSettingsRequest = z.infer<typeof updateFocusSettingsRequestSchema>;

// ---------------------------------------------------------------------------
// Tareas del día
// ---------------------------------------------------------------------------

export const focusTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  estimatedPomodoros: z.number().int(),
  completedPomodoros: z.number().int(),
  done: z.boolean(),
  /** Orden dentro de su día — lo usa el drag&drop de la cola. */
  position: z.number().int(),
  /** `YYYY-MM-DD`. */
  taskDate: z.string(),
  /** Id de `proyectos.tasks` si esta fila nació de "Importar mis tareas
   * asignadas" (gate funcional, decisión 2) — copia, nunca referencia viva. */
  sourceProyectosTaskId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});
export type FocusTask = z.infer<typeof focusTaskSchema>;
export const focusTasksResponseSchema = z.array(focusTaskSchema);

export const createFocusTaskRequestSchema = z.object({
  title: z.string().min(1).max(300),
  estimatedPomodoros: z.number().int().min(1).max(20).default(1),
  /** `YYYY-MM-DD`; si se omite, el servicio usa "hoy". */
  taskDate: z.string().min(1).optional()
});
export type CreateFocusTaskRequest = z.infer<typeof createFocusTaskRequestSchema>;

export const updateFocusTaskRequestSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  estimatedPomodoros: z.number().int().min(1).max(20).optional(),
  done: z.boolean().optional(),
  position: z.number().int().min(0).optional()
});
export type UpdateFocusTaskRequest = z.infer<typeof updateFocusTaskRequestSchema>;

export const importFocusTasksResponseSchema = z.object({
  imported: z.array(focusTaskSchema),
  /** Ya estaban importadas (mismo `sourceProyectosTaskId`) — no se duplican. */
  skippedAlreadyImported: z.number().int()
});
export type ImportFocusTasksResponse = z.infer<typeof importFocusTasksResponseSchema>;

// ---------------------------------------------------------------------------
// Sesiones (fuente de verdad de las estadísticas reales)
// ---------------------------------------------------------------------------

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

export const createFocusSessionRequestSchema = z.object({
  /** Tarea "actual" (primera no completada de la cola) según el cliente —
   * ausente durante un descanso o si la cola está vacía. */
  taskId: z.string().optional(),
  phase: focusSessionPhaseSchema,
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  durationSeconds: z.number().int().min(0),
  wasSkipped: z.boolean().default(false)
});
export type CreateFocusSessionRequest = z.infer<typeof createFocusSessionRequestSchema>;

// ---------------------------------------------------------------------------
// Dashboard / Desempeño
// ---------------------------------------------------------------------------

export const focusHourlyBucketSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minutes: z.number()
});
export type FocusHourlyBucket = z.infer<typeof focusHourlyBucketSchema>;

export const focusDashboardSchema = z.object({
  pomodorosCompletedToday: z.number().int(),
  focusMinutesToday: z.number(),
  tasksCompletedToday: z.number().int(),
  tasksInProgressToday: z.number().int(),
  tasksPendingToday: z.number().int(),
  /** 24 franjas (0-23, hora UTC de `startedAt`), minutos de enfoque completado en cada una. */
  hourlyDistribution: z.array(focusHourlyBucketSchema)
});
export type FocusDashboard = z.infer<typeof focusDashboardSchema>;

export const focusPerformanceRangeSchema = z.enum(['week', 'month']);
export type FocusPerformanceRange = z.infer<typeof focusPerformanceRangeSchema>;

export const focusPerformancePointSchema = z.object({
  /** `YYYY-MM-DD` (range=week, un punto por día) o `YYYY-MM-DD → YYYY-MM-DD`
   * (range=month, un punto por bloque de 7 días — "4 semanas" de la spec). */
  label: z.string(),
  pomodorosCompleted: z.number().int(),
  tasksCompletionRatePct: z.number(),
  effectiveFocusPct: z.number()
});
export type FocusPerformancePoint = z.infer<typeof focusPerformancePointSchema>;

export const focusPerformanceSchema = z.object({
  range: focusPerformanceRangeSchema,
  points: z.array(focusPerformancePointSchema),
  /** Días consecutivos (desde hoy hacia atrás) con >=1 sesión de enfoque
   * completada — gate técnico, decisión 4. */
  streakDays: z.number().int(),
  averagePomodorosPerDay: z.number()
});
export type FocusPerformance = z.infer<typeof focusPerformanceSchema>;

// ---------------------------------------------------------------------------
// Persistencia del ciclo activo del timer (change-2 — spec-tecnica.md
// "Persistencia del ciclo activo del temporizador"). Fila única por usuario,
// creada/actualizada perezosamente (mismo patrón lazy-upsert que
// `focusSettingsSchema`). El cliente sigue siendo la autoridad del conteo en
// curso: esto solo son puntos de referencia (`phaseStartedAt`/
// `accumulatedSeconds`/`running`) para reconstruir `remainingSeconds` al
// recargar/reabrir — NUNCA se escribe por tick, solo en eventos discretos
// (play/pausa, cambio de modo, reset, fin de fase — gate técnico change-2).
// ---------------------------------------------------------------------------

export const focusTimerStateSchema = z.object({
  id: z.string(),
  phase: focusSessionPhaseSchema,
  round: z.number().int(),
  /** Copia conceptual de `focus.tasks.id` (igual que `FocusSession.taskId`),
   * sin FK. `null` si el ciclo no tiene tarea asociada (descanso, o cola
   * vacía). */
  taskId: z.string().nullable(),
  /** Instante en que arrancó el tramo "corriendo" actual; `null` si está en
   * pausa. */
  phaseStartedAt: z.iso.datetime().nullable(),
  /** Segundos ya transcurridos de la fase antes del último pause/resume. */
  accumulatedSeconds: z.number().int(),
  running: z.boolean(),
  updatedAt: z.iso.datetime()
});
export type FocusTimerState = z.infer<typeof focusTimerStateSchema>;

export const putFocusTimerStateRequestSchema = z.object({
  phase: focusSessionPhaseSchema,
  round: z.number().int().min(1),
  taskId: z.string().nullable().optional(),
  phaseStartedAt: z.iso.datetime().nullable(),
  accumulatedSeconds: z.number().int().min(0),
  running: z.boolean()
});
export type PutFocusTimerStateRequest = z.infer<typeof putFocusTimerStateRequestSchema>;
