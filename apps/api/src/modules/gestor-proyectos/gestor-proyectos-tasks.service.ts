import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { AuditService } from '../../core/audit/audit.service';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GestorPermissionsService } from './gestor-proyectos-permissions.service';
import { CLOSED_STATUSES } from './gestor-proyectos-projects.service';
import { parseDateOnly, startOfDay } from './gestor-proyectos-workdays';
import type { TaskRow } from './gestor-proyectos.mappers';
import { resolveUserNames, toCommentDto, toSubtaskDto, toTaskRowDto } from './gestor-proyectos.mappers';
import type {
  CreateGestorCommentRequest,
  CreateGestorSubtaskRequest,
  CreateGestorTaskRequest,
  GestorComment,
  GestorDashboard,
  GestorSubtask,
  GestorTaskRow,
  UpdateGestorTaskRequest,
  UpdateGestorTaskStatusRequest
} from './gestor-proyectos.types';

// `satisfies` (en vez de anotar el tipo directo) preserva los literales
// ('asc', `true`) que Prisma necesita para inferir el shape exacto del
// resultado de `findMany`/`create`/`update` — un objeto suelto sin esto
// hace que TS infiera `include` de forma demasiado ancha y Prisma devuelva
// el tipo SIN `subtasks`/`comments` (found the hard way: TaskRow exige esos
// campos, así que un include mal tipado rompe en compilación, no en runtime).
const TASK_INCLUDE = {
  subtasks: true,
  comments: { orderBy: { createdAt: 'asc' } }
} satisfies Prisma.TaskInclude;
/** Tope de filas de "mis tareas"/"atrasadas" del dashboard — no hay paginación
 * en este MVP; con el volumen esperado (uso interno de Awakelab) es de sobra. */
const DASHBOARD_LIST_LIMIT = 50;

/**
 * Escritura de tareas/subtareas/comentarios. Cada método revalida el permiso
 * de fila correspondiente con `GestorPermissionsService` — el `RolesGuard`
 * del controller solo exige "estar autenticado" en estas rutas; la regla
 * fina (¿soy el asignado/creador de ESTA tarea?) vive aquí, no en el guard.
 */
@Injectable()
export class GestorTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: GestorPermissionsService
  ) {}

  /**
   * KPIs + "mis tareas" + atrasadas, ya filtrado server-side por lo que el
   * usuario puede ver (spec-tecnica.md: evita traer todas las tareas de la
   * plataforma al cliente solo para filtrarlas ahí, como hace el prototipo).
   * Admin: alcance de KPIs = toda la plataforma. No-admin: alcance = sus
   * propias tareas asignadas (su única noción de "lo que puede ver" fuera
   * del detalle de un proyecto concreto, que exige `participatesIn`).
   */
  async dashboard(user: AuthUser): Promise<GestorDashboard> {
    const isAdmin = this.permissions.isAdmin(user);
    const scopeWhere = isAdmin ? {} : { assigneeId: user.id };
    const today = startOfDay(new Date());

    const [statusGroups, projectGroups, overdueCount, myTasksRows, overdueRows] = await Promise.all([
      this.prisma.task.groupBy({ by: ['status'], where: scopeWhere, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['projectId', 'status'], where: scopeWhere, _count: { _all: true } }),
      this.prisma.task.count({
        where: { ...scopeWhere, status: { notIn: [...CLOSED_STATUSES] }, dueDate: { lt: today } }
      }),
      this.prisma.task.findMany({
        where: { assigneeId: user.id, status: { notIn: [...CLOSED_STATUSES] } },
        orderBy: { dueDate: 'asc' },
        take: DASHBOARD_LIST_LIMIT,
        include: TASK_INCLUDE
      }),
      this.prisma.task.findMany({
        where: { ...scopeWhere, status: { notIn: [...CLOSED_STATUSES] }, dueDate: { lt: today } },
        orderBy: { dueDate: 'asc' },
        take: DASHBOARD_LIST_LIMIT,
        include: TASK_INCLUDE
      })
    ]);

    const activeProjects = new Set(
      projectGroups.filter((g) => !CLOSED_STATUSES.has(g.status)).map((g) => g.projectId)
    ).size;
    const countByStatus = (status: string) =>
      statusGroups.find((g) => g.status === status)?._count._all ?? 0;
    const pendingTasks = countByStatus('iniciada') + countByStatus('en_progreso') + countByStatus('en_pausa');

    const [myTasks, overdue] = await Promise.all([
      this.toRowsWithNames(user, myTasksRows),
      this.toRowsWithNames(user, overdueRows)
    ]);

    return {
      activeProjects,
      pendingTasks,
      finishedTasks: countByStatus('finalizada'),
      overdueTasks: overdueCount,
      myTasks,
      overdue
    };
  }

  /** Tablero kanban del sprint (todas las tareas, cualquiera sea su asignado
   * — el filtrado por lo que cada usuario puede *hacer* vive en `permissions`
   * por tarea, no en ocultar tareas del tablero: participar en el proyecto
   * ya da visibilidad completa de su tablero, igual que el prototipo). */
  async sprintKanban(user: AuthUser, sprintId: string): Promise<GestorTaskRow[]> {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) throw new NotFoundException(`No existe el sprint "${sprintId}"`);

    if (!(await this.permissions.participatesIn(user, sprint.projectId))) {
      throw new ForbiddenException('No participas en este proyecto');
    }

    const rows = await this.prisma.task.findMany({
      where: { sprintId },
      orderBy: { createdAt: 'asc' },
      include: TASK_INCLUDE
    });
    return this.toRowsWithNames(user, rows);
  }

  async createTask(user: AuthUser, dto: CreateGestorTaskRequest): Promise<GestorTaskRow> {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: dto.sprintId } });
    if (!sprint) throw new NotFoundException(`No existe el sprint "${dto.sprintId}"`);

    const isAdmin = this.permissions.isAdmin(user);
    // "si el requester no es admin, assignee_id se fuerza a sí mismo" (spec-tecnica.md,
    // igual que createTask() del prototipo); si es admin, es obligatorio indicarlo.
    const assigneeId = isAdmin ? dto.assigneeId : user.id;
    if (!assigneeId) throw new BadRequestException('assigneeId es obligatorio al crear una tarea como admin');

    const row = await this.prisma.task.create({
      data: {
        projectId: sprint.projectId,
        sprintId: sprint.id,
        title: dto.title,
        dueDate: parseDateOnly(dto.dueDate),
        assigneeId,
        createdById: user.id
      },
      include: TASK_INCLUDE
    });

    await this.audit.log({
      actorId: user.id,
      action: 'gestor_proyectos.task_created',
      entity: 'proyectos.tasks',
      entityId: row.id,
      metadata: { title: row.title, assigneeId }
    });

    return this.toRowWithNames(user, row);
  }

  async updateStatus(user: AuthUser, taskId: string, dto: UpdateGestorTaskStatusRequest): Promise<GestorTaskRow> {
    const task = await this.requireTask(taskId);
    if (!this.permissions.canChangeStatus(user, task)) {
      throw new ForbiddenException('No puedes cambiar el estado de esta tarea');
    }

    const row = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status },
      include: TASK_INCLUDE
    });

    await this.audit.log({
      actorId: user.id,
      action: 'gestor_proyectos.task_status_changed',
      entity: 'proyectos.tasks',
      entityId: taskId,
      metadata: { from: task.status, to: dto.status }
    });

    return this.toRowWithNames(user, row);
  }

  async updateTask(user: AuthUser, taskId: string, dto: UpdateGestorTaskRequest): Promise<GestorTaskRow> {
    const task = await this.requireTask(taskId);
    if (!this.permissions.canEditTask(user, task)) {
      throw new ForbiddenException('No puedes editar esta tarea');
    }

    const row = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        dueDate: dto.dueDate ? parseDateOnly(dto.dueDate) : undefined,
        assigneeId: dto.assigneeId
      },
      include: TASK_INCLUDE
    });

    await this.audit.log({
      actorId: user.id,
      action: 'gestor_proyectos.task_updated',
      entity: 'proyectos.tasks',
      entityId: taskId,
      metadata: dto as Record<string, unknown>
    });

    return this.toRowWithNames(user, row);
  }

  async deleteTask(user: AuthUser, taskId: string): Promise<void> {
    const task = await this.requireTask(taskId);
    if (!this.permissions.canDeleteTask(user, task)) {
      throw new ForbiddenException('No puedes eliminar esta tarea');
    }

    await this.prisma.task.delete({ where: { id: taskId } });

    await this.audit.log({
      actorId: user.id,
      action: 'gestor_proyectos.task_deleted',
      entity: 'proyectos.tasks',
      entityId: taskId,
      metadata: { title: task.title }
    });
  }

  async addSubtask(user: AuthUser, taskId: string, dto: CreateGestorSubtaskRequest): Promise<GestorSubtask> {
    const task = await this.requireTask(taskId);
    if (!this.permissions.canAddInfo(user, task)) {
      throw new ForbiddenException('No puedes añadir información a esta tarea');
    }

    const row = await this.prisma.subtask.create({ data: { taskId, title: dto.title } });
    return toSubtaskDto(row);
  }

  async toggleSubtask(user: AuthUser, subtaskId: string, done: boolean): Promise<GestorSubtask> {
    const subtask = await this.prisma.subtask.findUnique({ where: { id: subtaskId } });
    if (!subtask) throw new NotFoundException(`No existe la subtarea "${subtaskId}"`);

    const task = await this.requireTask(subtask.taskId);
    if (!this.permissions.canAddInfo(user, task)) {
      throw new ForbiddenException('No puedes modificar esta subtarea');
    }

    const row = await this.prisma.subtask.update({ where: { id: subtaskId }, data: { done } });
    return toSubtaskDto(row);
  }

  async addComment(user: AuthUser, taskId: string, dto: CreateGestorCommentRequest): Promise<GestorComment> {
    const task = await this.requireTask(taskId);
    if (!this.permissions.canAddInfo(user, task)) {
      throw new ForbiddenException('No puedes comentar en esta tarea');
    }

    const row = await this.prisma.comment.create({ data: { taskId, authorId: user.id, text: dto.text } });
    const names = await resolveUserNames(this.prisma, [user.id]);
    return toCommentDto(row, names);
  }

  private async requireTask(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`No existe la tarea "${taskId}"`);
    return task;
  }

  private async toRowsWithNames(user: AuthUser, rows: TaskRow[]): Promise<GestorTaskRow[]> {
    const ids = new Set<string>();
    for (const row of rows) {
      ids.add(row.assigneeId);
      for (const comment of row.comments) ids.add(comment.authorId);
    }
    const names = await resolveUserNames(this.prisma, ids);
    return rows.map((row) => toTaskRowDto(row, this.permissions.taskPermissions(user, row), names));
  }

  /** Variante de una sola fila (create/update/status): evita el `[0]` sobre
   * un array de longitud 1, que con `noUncheckedIndexedAccess` sería `T | undefined`. */
  private async toRowWithNames(user: AuthUser, row: TaskRow): Promise<GestorTaskRow> {
    const ids = new Set<string>([row.assigneeId, ...row.comments.map((c) => c.authorId)]);
    const names = await resolveUserNames(this.prisma, ids);
    return toTaskRowDto(row, this.permissions.taskPermissions(user, row), names);
  }
}
