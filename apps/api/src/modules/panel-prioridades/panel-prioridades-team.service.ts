import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '@awk/auth';
import type { PanelTeamMember, CreateTeamMemberRequest, UpdateTeamMemberRequest } from './panel-prioridades.types';
import { PanelPrioritiesMappers } from './panel-prioridades.mappers';

/**
 * Servicio de gestión del equipo local del usuario.
 * Cada usuario solo ve/edita su propio equipo (RLS).
 */
@Injectable()
export class PanelPrioritiesTeamService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lista el equipo del usuario (solo activos por defecto, pero se puede filtrar).
   */
  async listTeamMembers(user: AuthUser, includeInactive = false): Promise<PanelTeamMember[]> {
    const where: any = { userId: user.id };
    if (!includeInactive) {
      where.active = true;
    }

    const members = await this.prisma.panelTeamMember.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    return members.map(m => PanelPrioritiesMappers.teamMemberToDto(m));
  }

  /**
   * Obtiene un miembro específico del equipo.
   */
  async getTeamMember(user: AuthUser, memberId: string): Promise<PanelTeamMember> {
    const member = await this.prisma.panelTeamMember.findUnique({
      where: { id: memberId }
    });

    if (!member) {
      throw new NotFoundException('Miembro del equipo no encontrado');
    }

    if (member.userId !== user.id) {
      throw new BadRequestException('No tienes permiso para acceder a este miembro');
    }

    return PanelPrioritiesMappers.teamMemberToDto(member);
  }

  /**
   * Añade un miembro nuevo al equipo.
   */
  async addTeamMember(user: AuthUser, request: CreateTeamMemberRequest): Promise<PanelTeamMember> {
    const member = await this.prisma.panelTeamMember.create({
      data: {
        userId: user.id,
        addedByUserId: user.id,
        name: request.name,
        email: request.email,
        active: true
      }
    });

    return PanelPrioritiesMappers.teamMemberToDto(member);
  }

  /**
   * Actualiza un miembro del equipo.
   */
  async updateTeamMember(
    user: AuthUser,
    memberId: string,
    request: UpdateTeamMemberRequest
  ): Promise<PanelTeamMember> {
    const existing = await this.prisma.panelTeamMember.findUnique({
      where: { id: memberId }
    });

    if (!existing) {
      throw new NotFoundException('Miembro del equipo no encontrado');
    }

    if (existing.userId !== user.id) {
      throw new BadRequestException('No tienes permiso para editar este miembro');
    }

    const updated = await this.prisma.panelTeamMember.update({
      where: { id: memberId },
      data: {
        name: request.name,
        email: request.email
      }
    });

    return PanelPrioritiesMappers.teamMemberToDto(updated);
  }

  /**
   * Desactiva un miembro (soft delete: active = false).
   */
  async removeTeamMember(user: AuthUser, memberId: string): Promise<void> {
    const existing = await this.prisma.panelTeamMember.findUnique({
      where: { id: memberId }
    });

    if (!existing) {
      throw new NotFoundException('Miembro del equipo no encontrado');
    }

    if (existing.userId !== user.id) {
      throw new BadRequestException('No tienes permiso para eliminar este miembro');
    }

    await this.prisma.panelTeamMember.update({
      where: { id: memberId },
      data: { active: false }
    });
  }
}
