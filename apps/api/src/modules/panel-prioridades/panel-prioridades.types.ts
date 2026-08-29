import { z } from 'zod';

/**
 * Contratos (Zod) del módulo panel-prioridades.
 *
 * Nota: estos esquemas quedan LOCALES a este módulo (no en @awk/types) por
 * el guardarraíl de generación (docs/04, paso 4). Ver focus-flow.types.ts.
 */

// Enums y constantes
export const panelTaskActionSchema = z.enum(['do', 'plan', 'delegate', 'eliminate']);
export type PanelTaskAction = z.infer<typeof panelTaskActionSchema>;

export const panelTaskOriginSchema = z.enum(['meeting', 'email', 'chat', 'self', 'direction']);
export type PanelTaskOrigin = z.infer<typeof panelTaskOriginSchema>;

export const panelTaskStatusSchema = z.enum(['open', 'done', 'discarded']);
export type PanelTaskStatus = z.infer<typeof panelTaskStatusSchema>;

// Estimación de dedicación (30 min – 4 h, en pasos de 30 min)
export const estimatedMinutesSchema = z.number().int().min(30).max(240).multipleOf(30);

// ---------------------------------------------------------------------------
// Tarea
// ---------------------------------------------------------------------------

export const panelTaskSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  detail: z.string().max(1000).nullable(),
  urgent: z.boolean(),
  important: z.boolean(),
  quadrant: z.number().int().min(1).max(4),
  action: panelTaskActionSchema,
  dueDate: z.coerce.date().nullable(),
  estimatedMinutes: estimatedMinutesSchema,
  origin: panelTaskOriginSchema,
  status: panelTaskStatusSchema,
  overdue: z.boolean(), // computado: dueDate < today && status === 'open'
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type PanelTask = z.infer<typeof panelTaskSchema>;

export const createPanelTaskRequestSchema = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().max(1000).nullable().optional(),
  urgent: z.boolean(),
  important: z.boolean(),
  dueDate: z.coerce.date().nullable().optional(),
  estimatedMinutes: estimatedMinutesSchema,
  origin: panelTaskOriginSchema,
  // Si cuadrante 3: delegación opcional
  delegatedToName: z.string().max(100).nullable().optional(),
  followUpDate: z.coerce.date().nullable().optional()
});
export type CreatePanelTaskRequest = z.infer<typeof createPanelTaskRequestSchema>;

export const updatePanelTaskRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  detail: z.string().max(1000).nullable().optional(),
  urgent: z.boolean().optional(),
  important: z.boolean().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  estimatedMinutes: estimatedMinutesSchema.optional(),
  origin: panelTaskOriginSchema.optional(),
  status: panelTaskStatusSchema.optional(),
  delegatedToName: z.string().max(100).nullable().optional(),
  followUpDate: z.coerce.date().nullable().optional()
});
export type UpdatePanelTaskRequest = z.infer<typeof updatePanelTaskRequestSchema>;

export const panelTasksListResponseSchema = z.array(panelTaskSchema);
export type PanelTasksListResponse = z.infer<typeof panelTasksListResponseSchema>;

// ---------------------------------------------------------------------------
// Bloque de agenda (schedule)
// ---------------------------------------------------------------------------

export const panelScheduleBlockSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  taskId: z.string().uuid().nullable(),
  dayOfWeek: z.number().int().min(0).max(4), // 0=lunes, 4=viernes
  hour: z.number().int().min(8).max(17),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type PanelScheduleBlock = z.infer<typeof panelScheduleBlockSchema>;

export const scheduleGridSchema = z.object({
  day: z.number().int().min(0).max(4),
  hour: z.number().int().min(8).max(17),
  taskId: z.string().uuid().nullable(),
  taskTitle: z.string().nullable()
});
export type ScheduleGrid = z.infer<typeof scheduleGridSchema>;

export const scheduleWeekSchema = z.array(
  z.object({
    day: z.number().int().min(0).max(4),
    blocks: z.array(scheduleGridSchema)
  })
);
export type ScheduleWeek = z.infer<typeof scheduleWeekSchema>;

// ---------------------------------------------------------------------------
// Miembro del equipo
// ---------------------------------------------------------------------------

export const panelTeamMemberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  addedByUserId: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type PanelTeamMember = z.infer<typeof panelTeamMemberSchema>;

export const createTeamMemberRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email()
});
export type CreateTeamMemberRequest = z.infer<typeof createTeamMemberRequestSchema>;

export const updateTeamMemberRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional()
});
export type UpdateTeamMemberRequest = z.infer<typeof updateTeamMemberRequestSchema>;

// ---------------------------------------------------------------------------
// Delegación
// ---------------------------------------------------------------------------

export const panelDelegationSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
  delegatedToName: z.string().max(100).nullable(),
  followUpDate: z.coerce.date().nullable(),
  followUpOverdue: z.boolean(), // computado: followUpDate < today
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type PanelDelegation = z.infer<typeof panelDelegationSchema>;

// ---------------------------------------------------------------------------
// KPIs e indicadores
// ---------------------------------------------------------------------------

export const kpiTileSchema = z.object({
  label: z.string(),
  value: z.number(),
  unit: z.string(),
  trend: z.enum(['up', 'down', 'neutral']).optional()
});
export type KPITile = z.infer<typeof kpiTileSchema>;

export const quadrantDistributionSchema = z.object({
  quadrant: z.number().int().min(1).max(4),
  taskCount: z.number().int(),
  totalMinutes: z.number().int()
});
export type QuadrantDistribution = z.infer<typeof quadrantDistributionSchema>;

export const diagnosticSchema = z.object({
  type: z.enum(['apagafuegos', 'bien_orientada', 'falta_fondo', 'urgencias_sin_responsable']),
  message: z.string()
});
export type Diagnostic = z.infer<typeof diagnosticSchema>;

export const panelKpisResponseSchema = z.object({
  openTasksCount: z.number().int(),
  weekScheduledMinutes: z.number().int(),
  q2PercentageMinutes: z.number().int(), // 0–100
  overdueTasksCount: z.number().int(),
  tasksByQuadrant: z.array(quadrantDistributionSchema),
  minutesByQuadrant: z.array(quadrantDistributionSchema),
  diagnostics: z.array(diagnosticSchema)
});
export type PanelKpisResponse = z.infer<typeof panelKpisResponseSchema>;
