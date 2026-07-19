import { z } from 'zod';

/**
 * Contratos (Zod) de `gestor-proyectos`.
 *
 * NOTA sobre dónde viven estos esquemas: `moodle-insights` y `orientador-ia`
 * comparten sus esquemas Zod vía `@awk/types` (front↔back, un solo archivo).
 * Este módulo se genera con aislamiento estricto de carpeta (docs/04, paso 4:
 * "Solo puede tocar las carpetas de su módulo") — no puede tocar
 * `packages/types`, que es un punto de integración compartido entre módulos
 * generados en paralelo. Los esquemas quedan, por tanto, LOCALES a este
 * módulo (aquí y en su espejo `apps/web/.../gestor-proyectos.types.ts`) — la
 * unificación en `@awk/types`, si se decide, es tarea de un paso posterior
 * del pipeline (integración/PR review), no de la generación.
 */

export const proyectosTaskStatusSchema = z.enum([
  'iniciada',
  'en_progreso',
  'en_pausa',
  'cancelada',
  'finalizada'
]);
export type ProyectosTaskStatus = z.infer<typeof proyectosTaskStatusSchema>;

// ---------------------------------------------------------------------------
// Sprints / proyectos
// ---------------------------------------------------------------------------

export const gestorSprintSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  /** Fecha de calendario `YYYY-MM-DD` (sin hora) — ver comentario en schema.prisma. */
  startDate: z.string(),
  endDate: z.string(),
  createdAt: z.iso.datetime()
});
export type GestorSprint = z.infer<typeof gestorSprintSchema>;

export const gestorProjectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
  tasksCount: z.number().int(),
  openTasksCount: z.number().int()
});
export type GestorProjectSummary = z.infer<typeof gestorProjectSummarySchema>;
export const gestorProjectsResponseSchema = z.array(gestorProjectSummarySchema);

export const gestorProjectDetailSchema = gestorProjectSummarySchema.extend({
  updatedAt: z.iso.datetime(),
  createdById: z.string(),
  sprints: z.array(gestorSprintSchema)
});
export type GestorProjectDetail = z.infer<typeof gestorProjectDetailSchema>;

export const createGestorProjectRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional()
});
export type CreateGestorProjectRequest = z.infer<typeof createGestorProjectRequestSchema>;

// ---------------------------------------------------------------------------
// Tareas / subtareas / comentarios
// ---------------------------------------------------------------------------

export const gestorSubtaskSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  title: z.string(),
  done: z.boolean(),
  createdAt: z.iso.datetime()
});
export type GestorSubtask = z.infer<typeof gestorSubtaskSchema>;

export const gestorCommentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  authorId: z.string(),
  /** Resuelto vía lookup a `core.users` (aplicación, no FK) — null si no se encontró. */
  authorName: z.string().nullable(),
  text: z.string(),
  createdAt: z.iso.datetime()
});
export type GestorComment = z.infer<typeof gestorCommentSchema>;

/** Matriz de permisos de esta tarea PARA el usuario que hace la request —
 * calculada en el backend (nunca solo en el cliente, ver spec-tecnica.md
 * "Lógica de permisos"). El frontend la usa únicamente para pintar/ocultar
 * botones; cada acción se vuelve a validar en su propio endpoint. */
export const gestorTaskPermissionsSchema = z.object({
  canChangeStatus: z.boolean(),
  canAddInfo: z.boolean(),
  canEditTask: z.boolean(),
  canDeleteTask: z.boolean()
});
export type GestorTaskPermissions = z.infer<typeof gestorTaskPermissionsSchema>;

export const gestorTaskRowSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sprintId: z.string(),
  title: z.string(),
  status: proyectosTaskStatusSchema,
  dueDate: z.string(),
  assigneeId: z.string(),
  assigneeName: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  subtasks: z.array(gestorSubtaskSchema),
  comments: z.array(gestorCommentSchema),
  permissions: gestorTaskPermissionsSchema
});
export type GestorTaskRow = z.infer<typeof gestorTaskRowSchema>;
export const gestorTasksResponseSchema = z.array(gestorTaskRowSchema);

export const createGestorTaskRequestSchema = z.object({
  sprintId: z.string().min(1),
  title: z.string().min(1).max(300),
  /** `YYYY-MM-DD`. */
  dueDate: z.string().min(1),
  /**
   * Opcional en el contrato: si el requester no es admin se fuerza a sí
   * mismo en el servicio (igual que `createTask()` del prototipo); si es
   * admin, es obligatorio (validado en el servicio, no aquí, porque la regla
   * depende del rol del requester, no solo de la forma del payload).
   */
  assigneeId: z.string().optional()
});
export type CreateGestorTaskRequest = z.infer<typeof createGestorTaskRequestSchema>;

export const updateGestorTaskStatusRequestSchema = z.object({ status: proyectosTaskStatusSchema });
export type UpdateGestorTaskStatusRequest = z.infer<typeof updateGestorTaskStatusRequestSchema>;

export const updateGestorTaskRequestSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  dueDate: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional()
});
export type UpdateGestorTaskRequest = z.infer<typeof updateGestorTaskRequestSchema>;

export const createGestorSubtaskRequestSchema = z.object({ title: z.string().min(1).max(300) });
export type CreateGestorSubtaskRequest = z.infer<typeof createGestorSubtaskRequestSchema>;

export const updateGestorSubtaskRequestSchema = z.object({ done: z.boolean() });
export type UpdateGestorSubtaskRequest = z.infer<typeof updateGestorSubtaskRequestSchema>;

export const createGestorCommentRequestSchema = z.object({ text: z.string().min(1).max(2000) });
export type CreateGestorCommentRequest = z.infer<typeof createGestorCommentRequestSchema>;

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const gestorDashboardSchema = z.object({
  activeProjects: z.number().int(),
  pendingTasks: z.number().int(),
  finishedTasks: z.number().int(),
  overdueTasks: z.number().int(),
  myTasks: z.array(gestorTaskRowSchema),
  overdue: z.array(gestorTaskRowSchema)
});
export type GestorDashboard = z.infer<typeof gestorDashboardSchema>;

// ---------------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------------

export const gestorReportPersonBreakdownSchema = z.object({
  userId: z.string(),
  userName: z.string().nullable(),
  total: z.number().int(),
  finished: z.number().int(),
  overdue: z.number().int()
});
export type GestorReportPersonBreakdown = z.infer<typeof gestorReportPersonBreakdownSchema>;

export const gestorReportSchema = z.object({
  sprint: gestorSprintSchema,
  totalTasks: z.number().int(),
  finishedTasks: z.number().int(),
  overdueTasks: z.number().int(),
  byStatus: z.array(z.object({ status: proyectosTaskStatusSchema, count: z.number().int() })),
  byPerson: z.array(gestorReportPersonBreakdownSchema),
  /** Avance real vs. esperado según días hábiles transcurridos del sprint. */
  projection: z.object({
    workDaysTotal: z.number().int(),
    workDaysElapsed: z.number().int(),
    expectedProgressPct: z.number(),
    actualProgressPct: z.number()
  })
});
export type GestorReport = z.infer<typeof gestorReportSchema>;
