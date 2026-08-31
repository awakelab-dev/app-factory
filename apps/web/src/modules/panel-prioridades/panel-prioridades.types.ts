import { z } from 'zod';

// Enums
export const panelTaskActionSchema = z.enum(['do', 'plan', 'delegate', 'eliminate']);
export type PanelTaskAction = z.infer<typeof panelTaskActionSchema>;

export const panelTaskOriginSchema = z.enum(['meeting', 'email', 'chat', 'self', 'direction']);
export type PanelTaskOrigin = z.infer<typeof panelTaskOriginSchema>;

export const panelTaskStatusSchema = z.enum(['open', 'done', 'discarded']);
export type PanelTaskStatus = z.infer<typeof panelTaskStatusSchema>;

export const estimatedMinutesSchema = z.number().int().min(30).max(240).multipleOf(30);

// Task
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
  overdue: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type PanelTask = z.infer<typeof panelTaskSchema>;

// Team Member
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

// Delegation
export const panelDelegationSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
  delegatedToName: z.string().max(100).nullable(),
  followUpDate: z.coerce.date().nullable(),
  followUpOverdue: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type PanelDelegation = z.infer<typeof panelDelegationSchema>;

// KPIs
export const panelKpisResponseSchema = z.object({
  openTasksCount: z.number().int(),
  weekScheduledMinutes: z.number().int(),
  q2PercentageMinutes: z.number().int(),
  overdueTasksCount: z.number().int(),
  tasksByQuadrant: z.array(z.any()),
  minutesByQuadrant: z.array(z.any()),
  diagnostics: z.array(z.any())
});
export type PanelKpisResponse = z.infer<typeof panelKpisResponseSchema>;

// Agenda semanal (la misma forma que devuelve GET /schedule en la API).
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

// Alta de miembro del equipo (cuerpo del POST /team).
export const createTeamMemberRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email()
});
export type CreateTeamMemberRequest = z.infer<typeof createTeamMemberRequestSchema>;

// Crear tarea (cuerpo del POST /tasks)
export const createPanelTaskRequestSchema = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().max(1000).nullable().optional(),
  urgent: z.boolean(),
  important: z.boolean(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedMinutes: estimatedMinutesSchema,
  origin: panelTaskOriginSchema,
  delegatedToName: z.string().max(100).nullable().optional(),
  followUpDate: z.string().datetime().nullable().optional()
});
export type CreatePanelTaskRequest = z.infer<typeof createPanelTaskRequestSchema>;

// Actualizar tarea (cuerpo del PUT /tasks/:id)
export const updatePanelTaskRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  detail: z.string().max(1000).nullable().optional(),
  urgent: z.boolean().optional(),
  important: z.boolean().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedMinutes: estimatedMinutesSchema.optional(),
  origin: panelTaskOriginSchema.optional(),
  status: panelTaskStatusSchema.optional(),
  delegatedToName: z.string().max(100).nullable().optional(),
  followUpDate: z.string().datetime().nullable().optional()
});
export type UpdatePanelTaskRequest = z.infer<typeof updatePanelTaskRequestSchema>;
