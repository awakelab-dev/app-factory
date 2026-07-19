import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateOnly, startOfDay } from './focus-flow-dates';
import { toTaskDto, type TaskRow } from './focus-flow.mappers';
import type { CreateFocusTaskRequest, FocusTask, ImportFocusTasksResponse, UpdateFocusTaskRequest } from './focus-flow.types';

/** Estado de `proyectos.tasks` que el gate técnico (decisión 2) excluye
 * textualmente ("status != completada") al importar — se toma literal, sin
 * ampliar a `cancelada` sin una nueva aprobación. */
const PROYECTOS_COMPLETED_STATUS = 'finalizada';
/** Estimado por defecto de una tarea importada: `proyectos.tasks` no tiene
 * noción de pomodoros, así que arranca en 1 y la persona la ajusta luego. */
const IMPORTED_TASK_ESTIMATE = 1;

/**
 * CRUD de la cola de tareas del día + importación desde `gestor-proyectos`
 * (gate funcional, decisión 2 — no estaba en la spec técnica original).
 * Aislamiento por fila más estricto de la plataforma (spec-tecnica.md): toda
 * consulta/mutación filtra por `userId = request.user.id` sin excepción, ni
 * siquiera para admin — por eso `requireOwnTask` lanza NotFound (nunca
 * Forbidden) cuando la tarea es de otra persona: este módulo no distingue
 * "no existe" de "no es tuya" en la respuesta.
 */
@Injectable()
export class FocusTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async listForDate(user: AuthUser, dateStr?: string): Promise<FocusTask[]> {
    const date = dateStr ? parseDateOnly(dateStr) : startOfDay(new Date());
    const rows = await this.prisma.focusTask.findMany({
      where: { userId: user.id, taskDate: date },
      orderBy: { position: 'asc' }
    });
    return rows.map(toTaskDto);
  }

  /** Crea la tarea al final de la cola de su día (spec-tecnica.md: "se añade al final de la cola"). */
  async createTask(user: AuthUser, dto: CreateFocusTaskRequest): Promise<FocusTask> {
    const date = dto.taskDate ? parseDateOnly(dto.taskDate) : startOfDay(new Date());
    const position = await this.nextPosition(user.id, date);

    const row = await this.prisma.focusTask.create({
      data: {
        userId: user.id,
        title: dto.title,
        estimatedPomodoros: dto.estimatedPomodoros,
        taskDate: date,
        position
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'focus_flow.task_created',
      entity: 'focus.tasks',
      entityId: row.id,
      metadata: { title: row.title }
    });

    return toTaskDto(row);
  }

  async updateTask(user: AuthUser, taskId: string, dto: UpdateFocusTaskRequest): Promise<FocusTask> {
    const task = await this.requireOwnTask(user, taskId);

    if (dto.position !== undefined) {
      await this.reposition(user.id, task, dto.position);
    }

    const row = await this.prisma.focusTask.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        estimatedPomodoros: dto.estimatedPomodoros,
        done: dto.done
      }
    });
    return toTaskDto(row);
  }

  async deleteTask(user: AuthUser, taskId: string): Promise<void> {
    const task = await this.requireOwnTask(user, taskId);

    // Las sesiones de esta tarea NO se borran (FK nullable, onDelete SetNull
    // en schema.prisma) — eliminar una tarea no debe perder el historial de
    // pomodoros ya contabilizado en el dashboard/desempeño.
    await this.prisma.focusTask.delete({ where: { id: taskId } });

    await this.audit.log({
      actorId: user.id,
      action: 'focus_flow.task_deleted',
      entity: 'focus.tasks',
      entityId: taskId,
      metadata: { title: task.title }
    });
  }

  /**
   * "Importar mis tareas asignadas" (gate funcional, decisión 2 — vinculante,
   * amplía la spec técnica original): copia de solo lectura de
   * `proyectos.tasks` asignadas al usuario y no completadas hacia la cola de
   * hoy, sin FK ni sincronización posterior (gate técnico, decisiones 2/3).
   * `sourceProyectosTaskId` evita reimportar la misma tarea dos veces.
   */
  async importFromProyectos(user: AuthUser): Promise<ImportFocusTasksResponse> {
    const assignedTasks = await this.prisma.task.findMany({
      where: { assigneeId: user.id, status: { not: PROYECTOS_COMPLETED_STATUS } },
      select: { id: true, title: true }
    });
    if (assignedTasks.length === 0) return { imported: [], skippedAlreadyImported: 0 };

    const alreadyImported = await this.prisma.focusTask.findMany({
      where: { userId: user.id, sourceProyectosTaskId: { in: assignedTasks.map((t) => t.id) } },
      select: { sourceProyectosTaskId: true }
    });
    const alreadyImportedIds = new Set(alreadyImported.map((t) => t.sourceProyectosTaskId));
    const toImport = assignedTasks.filter((t) => !alreadyImportedIds.has(t.id));

    if (toImport.length === 0) {
      return { imported: [], skippedAlreadyImported: assignedTasks.length };
    }

    const today = startOfDay(new Date());
    let position = await this.nextPosition(user.id, today);

    const imported: FocusTask[] = [];
    for (const source of toImport) {
      const row = await this.prisma.focusTask.create({
        data: {
          userId: user.id,
          title: source.title,
          estimatedPomodoros: IMPORTED_TASK_ESTIMATE,
          taskDate: today,
          position,
          sourceProyectosTaskId: source.id
        }
      });
      imported.push(toTaskDto(row));
      position += 1;
    }

    await this.audit.log({
      actorId: user.id,
      action: 'focus_flow.tasks_imported_from_proyectos',
      entity: 'focus.tasks',
      metadata: { count: imported.length }
    });

    return { imported, skippedAlreadyImported: assignedTasks.length - toImport.length };
  }

  private async nextPosition(userId: string, date: Date): Promise<number> {
    const last = await this.prisma.focusTask.findFirst({
      where: { userId, taskDate: date },
      orderBy: { position: 'desc' },
      select: { position: true }
    });
    return (last?.position ?? -1) + 1;
  }

  /**
   * Arrastrar-y-soltar: mueve `task` al índice `newPosition` dentro de su
   * propio día y renumera el resto de tareas de ese día a 0..n-1 (evita
   * huecos/empates tras muchos drags — el cliente solo necesita mandar el
   * índice destino, no recalcular las posiciones de sus vecinas).
   */
  private async reposition(userId: string, task: TaskRow, newPosition: number): Promise<void> {
    const siblings = await this.prisma.focusTask.findMany({
      where: { userId, taskDate: task.taskDate },
      orderBy: { position: 'asc' },
      select: { id: true }
    });
    const ids = siblings.map((s) => s.id).filter((id) => id !== task.id);
    const clampedIndex = Math.max(0, Math.min(newPosition, ids.length));
    ids.splice(clampedIndex, 0, task.id);

    await this.prisma.$transaction(
      ids.map((id, index) => this.prisma.focusTask.update({ where: { id }, data: { position: index } }))
    );
  }

  private async requireOwnTask(user: AuthUser, taskId: string): Promise<TaskRow> {
    const task = await this.prisma.focusTask.findUnique({ where: { id: taskId } });
    if (!task || task.userId !== user.id) throw new NotFoundException(`No existe la tarea "${taskId}"`);
    return task;
  }
}
