import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '@awk/auth';
import type { PanelDelegation } from './panel-prioridades.types';
import { PanelPrioritiesMappers } from './panel-prioridades.mappers';

/**
 * Servicio de gestión de delegaciones (cuadrante 3: Delegar).
 * Una delegación es 1:1 con una tarea (una sola tarea delegada a la vez).
 */
@Injectable()
export class PanelPrioritiesDelegationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lista todas las delegaciones urgentes (cuadrante 3) del usuario.
   */
  async listDelegations(user: AuthUser): Promise<PanelDelegation[]> {
    const delegations = await this.prisma.panelDelegation.findMany({
      where: { userId: user.id },
      include: { task: true },
      orderBy: { followUpDate: 'asc' }
    });

    return delegations.map(d =>
      PanelPrioritiesMappers.delegationToDto(d, this.isFollowUpOverdue(d.followUpDate))
    );
  }

  /**
   * Obtiene una delegación específica.
   */
  async getDelegation(user: AuthUser, delegationId: string): Promise<PanelDelegation> {
    const delegation = await this.prisma.panelDelegation.findUnique({
      where: { id: delegationId },
      include: { task: true }
    });

    if (!delegation) {
      throw new NotFoundException('Delegación no encontrada');
    }

    if (delegation.userId !== user.id) {
      throw new BadRequestException('No tienes permiso para acceder a esta delegación');
    }

    return PanelPrioritiesMappers.delegationToDto(delegation, this.isFollowUpOverdue(delegation.followUpDate));
  }

  /**
   * Asigna o actualiza una delegación para una tarea (solo cuadrante 3).
   * delegatedToName puede ser null (no requiere responsable).
   */
  async setDelegation(
    user: AuthUser,
    taskId: string,
    delegatedToName: string | null,
    followUpDate?: Date | null
  ): Promise<PanelDelegation> {
    const task = await this.prisma.panelTask.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (task.userId !== user.id) {
      throw new BadRequestException('No tienes permiso para delegar esta tarea');
    }

    if (task.quadrant !== 3) {
      throw new BadRequestException('Solo las tareas del cuadrante 3 (Delegar) pueden ser delegadas');
    }

    // Buscar delegación existente
    const existing = await this.prisma.panelDelegation.findUnique({
      where: { taskId }
    });

    if (existing) {
      // Actualizar
      const updated = await this.prisma.panelDelegation.update({
        where: { id: existing.id },
        data: {
          delegatedToName,
          followUpDate: followUpDate || null
        },
        include: { task: true }
      });

      return PanelPrioritiesMappers.delegationToDto(updated, this.isFollowUpOverdue(updated.followUpDate));
    } else {
      // Crear
      const created = await this.prisma.panelDelegation.create({
        data: {
          taskId,
          userId: user.id,
          delegatedToName,
          followUpDate: followUpDate || null
        },
        include: { task: true }
      });

      return PanelPrioritiesMappers.delegationToDto(created, false);
    }
  }

  /**
   * Limpia la delegación de una tarea (la borra o la deja sin responsable).
   * En la spec se describe como "limpiar delegación" cuando sale de Q3.
   */
  async clearDelegation(user: AuthUser, taskId: string): Promise<void> {
    const task = await this.prisma.panelTask.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (task.userId !== user.id) {
      throw new BadRequestException('No tienes permiso para limpiar esta delegación');
    }

    await this.prisma.panelDelegation.deleteMany({
      where: { taskId }
    });
  }

  /**
   * Verifica si la fecha de seguimiento está vencida.
   */
  private isFollowUpOverdue(followUpDate: Date | null): boolean {
    if (!followUpDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return followUpDate < today;
  }
}
