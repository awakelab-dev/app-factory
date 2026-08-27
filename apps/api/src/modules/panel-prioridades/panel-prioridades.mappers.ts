import type { PanelTask, PanelTeamMember, PanelDelegation } from './panel-prioridades.types';

/**
 * Mappers para convertir entidades PrismaService a DTOs.
 */
export class PanelPrioritiesMappers {
  /**
   * Convierte PanelTask de Prisma a DTO.
   */
  static taskToDto(entity: any, overdue: boolean): PanelTask {
    return {
      id: entity.id,
      userId: entity.userId,
      title: entity.title,
      detail: entity.detail,
      urgent: entity.urgent,
      important: entity.important,
      quadrant: entity.quadrant,
      action: entity.action,
      dueDate: entity.dueDate ? new Date(entity.dueDate).toISOString() : null,
      estimatedMinutes: entity.estimatedMinutes,
      origin: entity.origin,
      status: entity.status,
      overdue,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    } as any;
  }

  /**
   * Convierte PanelTeamMember de Prisma a DTO.
   */
  static teamMemberToDto(entity: any): PanelTeamMember {
    return {
      id: entity.id,
      userId: entity.userId,
      addedByUserId: entity.addedByUserId,
      name: entity.name,
      email: entity.email,
      active: entity.active,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    } as any;
  }

  /**
   * Convierte PanelDelegation de Prisma a DTO.
   */
  static delegationToDto(entity: any, followUpOverdue: boolean): PanelDelegation {
    return {
      id: entity.id,
      taskId: entity.taskId,
      userId: entity.userId,
      delegatedToName: entity.delegatedToName,
      followUpDate: entity.followUpDate ? new Date(entity.followUpDate).toISOString() : null,
      followUpOverdue,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    } as any;
  }
}
