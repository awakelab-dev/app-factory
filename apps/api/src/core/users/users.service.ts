import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CoreUser } from '@awk/types';
import { AuditService } from '../audit/audit.service';
import { RolesService } from '../roles/roles.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly audit: AuditService
  ) {}

  async list(): Promise<CoreUser[]> {
    const users = await this.prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' }
    });
    return users.map(toCoreUser);
  }

  /**
   * Alta de usuario de plataforma (incremento D, bloque 2 — cierre).
   *
   * Es el último paso del ciclo que seguía exigiendo SQL: `dev-login` solo
   * autentica usuarios que YA existen en `core.users`, así que un gerente del
   * piloto no podía entrar a staging a validar su propio módulo hasta que
   * alguien le insertaba la fila a mano.
   *
   * OJO — no confundir identidades: el actor de la Fábrica que crea
   * `cli create-actor` vive en `factory_actors` (otra BD) y sirve para el
   * conector de Cowork. Un gerente del piloto necesita LAS DOS COSAS.
   */
  async create(
    input: { email: string; displayName: string; roles: string[] },
    actorId?: string
  ): Promise<CoreUser> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(
        `Ya existe un usuario con el email ${email}. Si lo que quieres es cambiarle los roles o reactivarlo, hazlo sobre su fila.`
      );
    }

    const user = await this.prisma.user.create({
      data: { email, displayName: input.displayName.trim() }
    });
    await this.audit.log({
      actorId,
      action: 'core.user_created',
      entity: 'core.users',
      entityId: user.id,
      metadata: { email, displayName: user.displayName }
    });

    // Los roles se delegan al servicio que ya los valida y audita. Nunca se
    // crean roles al vuelo: si uno no existe, la asignación falla con 400 y el
    // usuario queda creado SIN roles — un estado válido y visible en la tabla,
    // no un alta a medias invisible.
    if (input.roles.length > 0) {
      return this.roles.setUserRoles(user.id, input.roles, actorId);
    }
    return this.findOne(user.id);
  }

  /**
   * Alta/baja de acceso. La baja es el interruptor que necesita un piloto:
   * `dev-login` rechaza a un usuario con `isActive: false`, así que cortar el
   * acceso deja de ser un `UPDATE` a mano. No borra nada — el histórico de
   * auditoría apunta a este usuario.
   */
  async setActive(id: string, isActive: boolean, actorId?: string): Promise<CoreUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`No existe el usuario ${id}`);
    if (user.isActive === isActive) return this.findOne(id);

    await this.prisma.user.update({ where: { id }, data: { isActive } });
    await this.audit.log({
      actorId,
      action: isActive ? 'core.user_activated' : 'core.user_deactivated',
      entity: 'core.users',
      entityId: id,
      metadata: { email: user.email }
    });
    return this.findOne(id);
  }

  private async findOne(id: string): Promise<CoreUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { roles: { include: { role: true } } }
    });
    return toCoreUser(user);
  }
}

interface UserWithRoles {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  createdAt: Date;
  roles: Array<{ role: { name: string } }>;
}

function toCoreUser(user: UserWithRoles): CoreUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isActive: user.isActive,
    roles: user.roles.map((userRole) => userRole.role.name),
    createdAt: user.createdAt.toISOString()
  };
}
