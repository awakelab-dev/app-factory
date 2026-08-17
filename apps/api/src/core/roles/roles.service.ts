import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CoreRole, CoreUser } from '@awk/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Roles del core: listado y asignación a usuarios (incremento D, bloque 2).
 *
 * La asignación existe porque sembrar el rol no basta: en `reserva-salas`
 * (D-049) el SQL a mano fueron DOS cosas —crear los roles y asignárselos al
 * admin que iba a validar— y solo la primera la arregla la siembra automática.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /** Roles existentes con cuántos usuarios los tienen, alfabéticos. */
  async list(): Promise<CoreRole[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } }
    });
    return roles.map((role) => ({
      name: role.name,
      description: role.description,
      usersCount: role._count.users
    }));
  }

  /**
   * Reemplaza el conjunto de roles de un usuario por el que llega (estado
   * final, no parche). Devuelve el usuario ya actualizado.
   *
   * OJO — los roles viajan en el JWT (`AuthService` los mete en el payload al
   * login): quien tenga sesión abierta NO ve el cambio hasta volver a entrar.
   * La UI lo avisa; cambiarlo de raíz (que el guard lea los roles de la BD en
   * cada request) es una decisión aparte, anotada en el diseño del incremento D.
   */
  async setUserRoles(userId: string, roleNames: string[], actorId?: string): Promise<CoreUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`No existe el usuario ${userId}`);

    const requested = [...new Set(roleNames)];
    const roles = await this.prisma.role.findMany({ where: { name: { in: requested } } });
    const unknown = requested.filter((name) => !roles.some((role) => role.name === name));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Estos roles no existen: ${unknown.join(', ')}. Los roles se siembran solos al arrancar la API desde los @Roles() de cada módulo; consulta GET /api/core/roles.`
      );
    }

    const previous = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });
    const previousNames = previous.map((entry) => entry.role.name).sort();

    const roleIds = roles.map((role) => role.id);
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId, roleId: { notIn: roleIds } } }),
      this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
        skipDuplicates: true
      })
    ]);

    await this.audit.log({
      actorId,
      action: 'core.user_roles_changed',
      entity: 'core.users',
      entityId: userId,
      metadata: { before: previousNames, after: [...requested].sort() }
    });

    return this.findUser(userId);
  }

  private async findUser(userId: string): Promise<CoreUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { role: true } } }
    });
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isActive: user.isActive,
      roles: user.roles.map((userRole) => userRole.role.name),
      createdAt: user.createdAt.toISOString()
    };
  }
}
