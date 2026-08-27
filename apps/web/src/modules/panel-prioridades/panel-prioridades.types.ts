import { z } from 'zod';

/**
 * Espejo exacto de apps/api/src/modules/panel-prioridades/panel-prioridades.types.ts
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const taskStatusEnum = z.enum(['open', 'done', 'discarded']);
export type TaskStatus = z.infer<typeof taskStatusEnum>;

export const taskActionEnum = z.enum(['do', 'plan', 'delegate', 'eliminate']);
export type TaskAction = z.infer<typeof taskActionEnum>;

export const taskOriginEnum = z.enum(['meeting', 'email', 'chat', 'self', 'direction']);
export type TaskOrigin = z.infer<typeof taskOriginEnum>;

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const taskSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  detail: z.string().max(1000).nullable(),
  urgent: z.boolean(),
  important: z.boolean(),
  quadrant: z.number().int().min(1).max(4),
  action: taskActionEnum,
  dueDate: z.coerce.date().nullable(),
  estimatedMinutes: z.number().int().min(30).max(240),
  origin: taskOriginEnum,
  status: taskStatusEnum,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type Task = z.infer<typeof taskSchema>;

export const taskWithOverdueSchema = taskSchema.extend({
  overdue: z.boolean()
});
export type TaskWithOverdue = z.infer<typeof taskWithOverdueSchema>;

export const tasksListResponseSchema = z.object({
  tasks: z.array(taskWithOverdueSchema),
  total: z.number().int()
});
export type TasksListResponse = z.infer<typeof tasksListResponseSchema>;

export const taskHistorySchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  taskId: z.string().uuid().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date()
});
export type TaskHistory = z.infer<typeof taskHistorySchema>;

export const taskHistoryListSchema = z.object({
  history: z.array(taskHistorySchema)
});
export type TaskHistoryList = z.infer<typeof taskHistoryListSchema>;

// ---------------------------------------------------------------------------
// Schedule Blocks
// ---------------------------------------------------------------------------

export const scheduleBlockSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  taskId: z.string().uuid().nullable(),
  dayOfWeek: z.number().int().min(0).max(4),
  hour: z.number().int().min(8).max(17),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type ScheduleBlock = z.infer<typeof scheduleBlockSchema>;

export const scheduleGridSchema = z.object({
  blocks: z.array(
    z.object({
      dayOfWeek: z.number().int(),
      hour: z.number().int(),
      taskId: z.string().uuid().nullable(),
      taskTitle: z.string().nullable()
    })
  )
});
export type ScheduleGrid = z.infer<typeof scheduleGridSchema>;

// ---------------------------------------------------------------------------
// Team Members
// ---------------------------------------------------------------------------

export const teamMemberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  addedByUserId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  active: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const teamListResponseSchema = z.object({
  team: z.array(teamMemberSchema)
});
export type TeamListResponse = z.infer<typeof teamListResponseSchema>;

// ---------------------------------------------------------------------------
// Delegations
// ---------------------------------------------------------------------------

export const delegationSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
  delegatedToName: z.string().nullable(),
  followUpDate: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type Delegation = z.infer<typeof delegationSchema>;

export const delegationWithTaskSchema = delegationSchema.extend({
  taskTitle: z.string(),
  taskStatus: taskStatusEnum,
  followUpOverdue: z.boolean()
});
export type DelegationWithTask = z.infer<typeof delegationWithTaskSchema>;


// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export const kpIsSchema = z.object({
  totalOpen: z.number().int(),
  totalHoursScheduled: z.number().min(0),
  percentageQ2: z.number().min(0).max(100),
  overdueCount: z.number().int(),
  delegationsWithoutResponsible: z.number().int(),
  tasksByQuadrant: z.object({
    q1: z.number().int(),
    q2: z.number().int(),
    q3: z.number().int(),
    q4: z.number().int()
  }),
  hoursByQuadrant: z.object({
    q1: z.number().min(0),
    q2: z.number().min(0),
    q3: z.number().min(0),
    q4: z.number().min(0)
  }),
  diagnostics: z.array(
    z.object({
      key: z.string(),
      message: z.string(),
      severity: z.enum(['info', 'warning', 'critical'])
    })
  )
});
export type KPIs = z.infer<typeof kpIsSchema>;
