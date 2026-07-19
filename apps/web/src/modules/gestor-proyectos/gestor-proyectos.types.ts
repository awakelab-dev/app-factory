import { z } from 'zod';

/**
 * Contratos de `gestor-proyectos` en el lado web.
 *
 * Estos esquemas de RESPUESTA son un espejo deliberado de
 * `apps/api/src/modules/gestor-proyectos/gestor-proyectos.types.ts` — no se
 * importan desde `@awk/types` (patrón de `moodle-insights`/`orientador-ia`)
 * porque este módulo se genera con aislamiento estricto de carpeta (docs/04,
 * paso 4: "Solo puede tocar las carpetas de su módulo") y no puede tocar
 * `packages/types`, punto de integración compartido entre módulos generados
 * en paralelo. Si se decide unificar en `@awk/types`, es tarea de un paso
 * posterior del pipeline, no de la generación. Los tipos de REQUEST (los que
 * solo sirven para construir el body de un `fetch`) son interfaces TS
 * simples, sin Zod, porque `apiFetch` nunca valida lo que se envía.
 */

export const proyectosTaskStatusSchema = z.enum([
  'iniciada',
  'en_progreso',
  'en_pausa',
  'cancelada',
  'finalizada'
]);
export type ProyectosTaskStatus = z.infer<typeof proyectosTaskStatusSchema>;

export const gestorSprintSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
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
  authorName: z.string().nullable(),
  text: z.string(),
  createdAt: z.iso.datetime()
});
export type GestorComment = z.infer<typeof gestorCommentSchema>;

/** Matriz de permisos calculada en el backend para el usuario que hace la
 * request — se usa SOLO para pintar/ocultar botones; cada acción se vuelve
 * a validar en su endpoint (spec-tecnica.md "Lógica de permisos"). */
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

export const gestorDashboardSchema = z.object({
  activeProjects: z.number().int(),
  pendingTasks: z.number().int(),
  finishedTasks: z.number().int(),
  overdueTasks: z.number().int(),
  myTasks: z.array(gestorTaskRowSchema),
  overdue: z.array(gestorTaskRowSchema)
});
export type GestorDashboard = z.infer<typeof gestorDashboardSchema>;

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
  projection: z.object({
    workDaysTotal: z.number().int(),
    workDaysElapsed: z.number().int(),
    expectedProgressPct: z.number(),
    actualProgressPct: z.number()
  })
});
export type GestorReport = z.infer<typeof gestorReportSchema>;

// ---------------------------------------------------------------------------
// Request bodies — interfaces simples (sin Zod: apiFetch no valida lo que
// se envía, solo lo que llega).
// ---------------------------------------------------------------------------

export interface CreateGestorProjectRequest {
  name: string;
  description?: string;
}

export interface CreateGestorTaskRequest {
  sprintId: string;
  title: string;
  dueDate: string;
  assigneeId?: string;
}

export interface UpdateGestorTaskStatusRequest {
  status: ProyectosTaskStatus;
}

export interface UpdateGestorTaskRequest {
  title?: string;
  dueDate?: string;
  assigneeId?: string;
}

export interface CreateGestorSubtaskRequest {
  title: string;
}

export interface UpdateGestorSubtaskRequest {
  done: boolean;
}

export interface CreateGestorCommentRequest {
  text: string;
}
