import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '@awk/auth';
import type {
  PanelTask,
  CreatePanelTaskRequest,
  UpdatePanelTaskRequest,
  PanelTasksListResponse
} from './panel-prioridades.types';
import { PanelPrioritiesMappers } from './panel-prioridades.mappers';

/**
 * Servicio de gestión de tareas del panel de prioridades.
 * Cada endpoint filtra implícitamente por user_id del request (RLS + aplicación).
 */
@Injectable()
export class PanelPrioritiesTasksService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calcula el cuadrante (1..4) y la acción basado en urgent/important.
   */
  private computeQuadrantAndAction(urgent: boolean, important: boolean): { quadrant: number; action: string } {
    if (urgent && important) return { quadrant: 1, action: 'do' };
    if (!urgent && important) return { quadrant: 2, action: 'plan' };
    if (urgent && !important) return { quadrant: 3, action: 'delegate' };
    return { quadrant: 4, action: 'eliminate' };
  }

  /**
   * Comprueba si una fecha está vencida (< hoy y estado open).
   */
  private isOverdue(dueDate: Date | null, status: string): boolean {
    if (!dueDate || status !== 'open') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }

  /**
   * Lista de tareas abiertas del usuario, opcionalmente filtradas.
   */
  async listTasks(
    user: AuthUser,
    filters?: { quadrant?: number; status?: string; origin?: string }
  ): Promise<PanelTasksListResponse> {
    const where: any = { userId: user.id };

    if (filters?.quadrant !== undefined) {
      where.quadrant = filters.quadrant;
    }
    if (filters?.status !== undefined) {
      where.status = filters.status;
    }
    if (filters?.origin !== undefined) {
      where.origin = filters.origin;
    }

    const tasks = await this.prisma.panelTask.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
    });

    return tasks.map(t => PanelPrioritiesMappers.taskToDto(t, this.isOverdue(t.dueDate, t.status)));
  }

  /**
   * Obtiene una tarea específica (validando propiedad).
   */
  async getTask(user: AuthUser, taskId: string): Promise<PanelTask> {
    const task = await this.prisma.panelTask.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (task.userId !== user.id) {
      throw new BadRequestException('No tienes permiso para acceder a esta tarea');
    }

    return PanelPrioritiesMappers.taskToDto(task, this.isOverdue(task.dueDate, task.status));
  }

  /**
   * Crea una nueva tarea.
   * Si es cuadrante 3 y se proporciona delegatedToName, crea también la delegación.
   */
  async createTask(user: AuthUser, request: CreatePanelTaskRequest): Promise<PanelTask> {
    const { quadrant, action } = this.computeQuadrantAndAction(request.urgent, request.important);

    // Validar que cuadrante 3 sin responsable sea permitido (aviso, no bloqueo)
    // pero si hay responsable, se crear la delegación en la misma transacción

    const task = await this.prisma.$transaction(async (tx) => {
      // Crear tarea
      const newTask = await tx.panelTask.create({
        data: {
          userId: user.id,
          title: request.title,
          detail: request.detail || null,
          urgent: request.urgent,
          important: request.important,
          quadrant,
          action,
          dueDate: request.dueDate || null,
          estimatedMinutes: request.estimatedMinutes,
          origin: request.origin,
          status: 'open'
        }
      });

      // Si es cuadrante 3 y hay responsable, crear delegación
      if (quadrant === 3 && request.delegatedToName) {
        await tx.panelDelegation.create({
          data: {
            taskId: newTask.id,
            userId: user.id,
            delegatedToName: request.delegatedToName,
            followUpDate: request.followUpDate || null
          }
        });
      }

      return newTask;
    });

    return PanelPrioritiesMappers.taskToDto(task, false);
  }

  /**
   * Actualiza una tarea existente.
   * Si cambia urgent/important, recalcula cuadrante y acción.
   * Si la nueva acción es eliminar (Q4) bloques existentes.
   * Si sale de Q3, limpia delegación (pero requiere nota del reviewer si es un cambio sensible).
   */
  async updateTask(user: AuthUser, taskId: string, request: UpdatePanelTaskRequest): Promise<PanelTask> {
    const existing = await this.prisma.panelTask.findUnique({
      where: { id: taskId }
    });

    if (!existing) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (existing.userId !== user.id) {
      throw new BadRequestException('No tienes permiso para editar esta tarea');
    }

    const urgent = request.urgent ?? existing.urgent;
    const important = request.important ?? existing.important;
    const { quadrant, action } = this.computeQuadrantAndAction(urgent, important);

    const updated = await this.prisma.$transaction(async (tx) => {
      // Actualizar tarea
      const updatedTask = await tx.panelTask.update({
        where: { id: taskId },
        data: {
          title: request.title,
          detail: request.detail,
          urgent,
          important,
          quadrant,
          action,
          dueDate: request.dueDate,
          estimatedMinutes: request.estimatedMinutes,
          origin: request.origin,
          status: request.status
        }
      });

      // Si el nuevo cuadrante es 4 (eliminate): eliminar bloques agendados
      if (quadrant === 4) {
        await tx.panelScheduleBlock.deleteMany({
          where: { taskId }
        });
      }

      // Si sale de cuadrante 3: limpiar delegación (pero el usuario puede re-asignar luego)
      if (existing.quadrant === 3 && quadrant !== 3) {
        await tx.panelDelegation.deleteMany({
          where: { taskId }
        });
      }

      // Si entra en cuadrante 3: delegación queda vacía (no se crea auto)
      // El usuario debe asignarla manualmente con PUT /tasks/:id/delegate

      return updatedTask;
    });

    return PanelPrioritiesMappers.taskToDto(updated, this.isOverdue(updated.dueDate, updated.status));
  }

  /**
   * Marca una tarea como cerrada (done/discarded) y libera sus bloques.
   * Técnicamente usa un soft delete (status = discarded) pero también soporta "done".
   */
  async closeTask(user: AuthUser, taskId: string, newStatus: 'done' | 'discarded'): Promise<PanelTask> {
    const existing = await this.prisma.panelTask.findUnique({
      where: { id: taskId }
    });

    if (!existing) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (existing.userId !== user.id) {
      throw new BadRequestException('No tienes permiso para cerrar esta tarea');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Liberar bloques agendados
      await tx.panelScheduleBlock.deleteMany({
        where: { taskId }
      });

      // Actualizar estado
      const updatedTask = await tx.panelTask.update({
        where: { id: taskId },
        data: { status: newStatus }
      });

      return updatedTask;
    });

    return PanelPrioritiesMappers.taskToDto(updated, false);
  }

  /**
   * Obtiene el historial de cambios de una tarea (desde audit_trail).
   */
  async getTaskHistory(user: AuthUser, taskId: string) {
    const task = await this.prisma.panelTask.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (task.userId !== user.id) {
      throw new BadRequestException('No tienes permiso para acceder a este historial');
    }

    const history = await this.prisma.panelAuditTrail.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' }
    });

    return history;
  }
}
