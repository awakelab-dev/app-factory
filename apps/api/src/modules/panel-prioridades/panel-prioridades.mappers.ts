import type { PanelTask, PanelTeamMember, PanelDelegation } from './panel-prioridades.types';

interface PrismaTaskEntity {
  id: string;
  userId: string;
  title: string;
  detail: string | null;
  urgent: boolean;
  important: boolean;
  quadrant: number;
  action: string;
  dueDate: Date | null;
  estimatedMinutes: number;
  origin: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PrismaTeamMemberEntity {
  id: string;
  userId: string;
  addedByUserId: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface PrismaDelegationEntity {
  id: string;
  taskId: string;
  userId: string;
  delegatedToName: string | null;
  followUpDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mappers para convertir entidades PrismaService a DTOs.
 */
export class PanelPrioritiesMappers {
  /**
   * Convierte PanelTask de Prisma a DTO.
   */
  static taskToDto(entity: PrismaTaskEntity, overdue: boolean): PanelTask {
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
    } as PanelTask;
  }

  /**
   * Convierte PanelTeamMember de Prisma a DTO.
   */
  static teamMemberToDto(entity: PrismaTeamMemberEntity): PanelTeamMember {
    return {
      id: entity.id,
      userId: entity.userId,
      addedByUserId: entity.addedByUserId,
      name: entity.name,
      email: entity.email,
      active: entity.active,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    } as PanelTeamMember;
  }

  /**
   * Convierte PanelDelegation de Prisma a DTO.
   */
  static delegationToDto(entity: PrismaDelegationEntity, followUpOverdue: boolean): PanelDelegation {
    return {
      id: entity.id,
      taskId: entity.taskId,
      userId: entity.userId,
      delegatedToName: entity.delegatedToName,
      followUpDate: entity.followUpDate ? new Date(entity.followUpDate).toISOString() : null,
      followUpOverdue,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    } as PanelDelegation;
  }
}
