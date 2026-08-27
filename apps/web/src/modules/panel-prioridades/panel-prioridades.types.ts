import { z } from 'zod';

/**
 * Tipos locales para el módulo panel-prioridades en React.
 * Espejo de los tipos del backend (apps/api/src/modules/panel-prioridades/panel-prioridades.types.ts).
 */

export const panelTaskActionSchema = z.enum(['do', 'plan', 'delegate', 'eliminate']);
export type PanelTaskAction = z.infer<typeof panelTaskActionSchema>;

export const panelTaskOriginSchema = z.enum(['meeting', 'email', 'chat', 'self', 'direction']);
export type PanelTaskOrigin = z.infer<typeof panelTaskOriginSchema>;

export const panelTaskStatusSchema = z.enum(['open', 'done', 'discarded']);
export type PanelTaskStatus = z.infer<typeof panelTaskStatusSchema>;

export const estimatedMinutesSchema = z.number().int().min(30).max(240).multipleOf(30);

// Tarea
export const panelTaskSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  detail: z.string().max(1000).nullable(),
  urgent: z.boolean(),
  important: z.boolean(),
  quadrant: z.number().int().min(1).max(4),
  action: panelTaskActionSchema,
  dueDate: z.string().nullable(),
  estimatedMinutes: estimatedMinutesSchema,
  origin: panelTaskOriginSchema,
  status: panelTaskStatusSchema,
  overdue: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type PanelTask = z.infer<typeof panelTaskSchema>;

// Miembro del equipo
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

// Delegación
export const panelDelegationSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
  delegatedToName: z.string().max(100).nullable(),
  followUpDate: z.string().nullable(),
  followUpOverdue: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type PanelDelegation = z.infer<typeof panelDelegationSchema>;

// KPIs
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
  q2PercentageMinutes: z.number().int(),
  overdueTasksCount: z.number().int(),
  tasksByQuadrant: z.array(quadrantDistributionSchema),
  minutesByQuadrant: z.array(quadrantDistributionSchema),
  diagnostics: z.array(diagnosticSchema)
});
export type PanelKpisResponse = z.infer<typeof panelKpisResponseSchema>;
