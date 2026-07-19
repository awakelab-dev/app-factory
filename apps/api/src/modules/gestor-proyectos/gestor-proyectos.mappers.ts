import type {
  GestorComment,
  GestorProjectDetail,
  GestorProjectSummary,
  GestorSprint,
  GestorSubtask,
  GestorTaskPermissions,
  GestorTaskRow,
  ProyectosTaskStatus
} from './gestor-proyectos.types';
import { formatDateOnly } from './gestor-proyectos-workdays';
import type { PrismaService } from '../../prisma/prisma.service';

// Formas mínimas de fila de Prisma que necesita cada mapper (evita acoplar
// este archivo al tipo generado completo — mismo patrón que
// orientador-ia.mappers.ts).

export interface SprintRow {
  id: string;
  projectId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export interface ProjectSummaryRow {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  tasksCount: number;
  openTasksCount: number;
}

export interface SubtaskRow {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  createdAt: Date;
}

export interface CommentRow {
  id: string;
  taskId: string;
  authorId: string;
  text: string;
  createdAt: Date;
}

export interface TaskRow {
  id: string;
  projectId: string;
  sprintId: string;
  title: string;
  status: ProyectosTaskStatus;
  dueDate: Date;
  assigneeId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  subtasks: SubtaskRow[];
  comments: CommentRow[];
}

export function toSprintDto(row: SprintRow): GestorSprint {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    startDate: formatDateOnly(row.startDate),
    endDate: formatDateOnly(row.endDate),
    createdAt: row.createdAt.toISOString()
  };
}

export function toProjectSummaryDto(row: ProjectSummaryRow): GestorProjectSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    tasksCount: row.tasksCount,
    openTasksCount: row.openTasksCount
  };
}

export interface ProjectDetailRow extends ProjectSummaryRow {
  updatedAt: Date;
  createdById: string;
  sprints: SprintRow[];
}

export function toProjectDetailDto(row: ProjectDetailRow): GestorProjectDetail {
  return {
    ...toProjectSummaryDto(row),
    updatedAt: row.updatedAt.toISOString(),
    createdById: row.createdById,
    sprints: row.sprints.map(toSprintDto)
  };
}

export function toSubtaskDto(row: SubtaskRow): GestorSubtask {
  return {
    id: row.id,
    taskId: row.taskId,
    title: row.title,
    done: row.done,
    createdAt: row.createdAt.toISOString()
  };
}

export function toCommentDto(row: CommentRow, names: ReadonlyMap<string, string>): GestorComment {
  return {
    id: row.id,
    taskId: row.taskId,
    authorId: row.authorId,
    authorName: names.get(row.authorId) ?? null,
    text: row.text,
    createdAt: row.createdAt.toISOString()
  };
}

export function toTaskRowDto(
  row: TaskRow,
  permissions: GestorTaskPermissions,
  names: ReadonlyMap<string, string>
): GestorTaskRow {
  return {
    id: row.id,
    projectId: row.projectId,
    sprintId: row.sprintId,
    title: row.title,
    status: row.status,
    dueDate: formatDateOnly(row.dueDate),
    assigneeId: row.assigneeId,
    assigneeName: names.get(row.assigneeId) ?? null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    subtasks: row.subtasks.map(toSubtaskDto),
    comments: row.comments.map((c) => toCommentDto(c, names)),
    permissions
  };
}

/**
 * Lookup de nombres de `core.users` (join a nivel de aplicación, no FK de
 * base de datos — ver comentario en schema.prisma). Se usa para mostrar
 * `assigneeName`/`authorName` en las respuestas sin duplicar una tabla de
 * usuarios dentro de `proyectos` ni depender de `GET /api/core/users`, que
 * es solo-admin (spec-tecnica.md: ese endpoint se reutiliza para el selector
 * "asignar a" del frontend, pero no sirve para que un `user` normal resuelva
 * el nombre de un compañero al ver el tablero).
 */
export async function resolveUserNames(
  prisma: PrismaService,
  ids: Iterable<string>
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, displayName: true }
  });
  return new Map(users.map((u) => [u.id, u.displayName]));
}
