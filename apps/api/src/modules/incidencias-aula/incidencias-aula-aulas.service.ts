import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IncidenciasPermissionsService } from './incidencias-aula-permissions.service';
import { toAulaDto } from './incidencias-aula.mappers';
import type { Aula, CreateAulaRequest, UpdateAulaRequest } from './incidencias-aula.types';

/**
 * Catálogo de aulas (gate funcional, decisión 4 — AMPLIACIÓN de alcance
 * sobre la spec técnica original): editable SOLO por `admin` de plataforma.
 * Baja LÓGICA (`activa=false`), nunca `DELETE` — hay incidencias que
 * referencian el aula y el resumen mensual de Dirección sigue agregando
 * también las inactivas para no falsear el histórico (por eso ese servicio
 * nunca filtra por `activa`, ver `IncidenciasResumenService`).
 */
@Injectable()
export class IncidenciasAulasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: IncidenciasPermissionsService
  ) {}

  /**
   * Catálogo para el formulario del docente y los filtros de coordinación:
   * SOLO aulas activas (gate funcional, decisión 4). `todas=true` solo se
   * honra si el requester es admin (pantalla de gestión) — un no-admin que
   * fuerce el query param igualmente recibe solo las activas, la comprobación
   * de rol se revalida aquí, no solo en `@Roles` del controller.
   */
  async listForUser(user: AuthUser, todas: boolean): Promise<Aula[]> {
    const includeInactive = todas && this.permissions.isAdmin(user);
    const rows = await this.prisma.aula.findMany({
      where: includeInactive ? undefined : { activa: true },
      orderBy: { nombre: 'asc' }
    });
    return rows.map(toAulaDto);
  }

  async create(user: AuthUser, dto: CreateAulaRequest): Promise<Aula> {
    const clash = await this.prisma.aula.findUnique({ where: { nombre: dto.nombre } });
    if (clash) throw new BadRequestException(`Ya existe un aula con el nombre "${dto.nombre}"`);

    const row = await this.prisma.aula.create({ data: { nombre: dto.nombre } });

    await this.audit.log({
      actorId: user.id,
      action: 'incidencias_aula.aula_created',
      entity: 'incidencias.aulas',
      entityId: row.id,
      metadata: { nombre: row.nombre }
    });

    return toAulaDto(row);
  }

  /** Renombrar y/o activar/desactivar — nunca borra la fila. */
  async update(user: AuthUser, aulaId: string, dto: UpdateAulaRequest): Promise<Aula> {
    const exists = await this.prisma.aula.findUnique({ where: { id: aulaId } });
    if (!exists) throw new NotFoundException(`No existe el aula "${aulaId}"`);

    if (dto.nombre !== undefined && dto.nombre !== exists.nombre) {
      const clash = await this.prisma.aula.findUnique({ where: { nombre: dto.nombre } });
      if (clash) throw new BadRequestException(`Ya existe un aula con el nombre "${dto.nombre}"`);
    }

    const row = await this.prisma.aula.update({
      where: { id: aulaId },
      data: { nombre: dto.nombre, activa: dto.activa }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'incidencias_aula.aula_updated',
      entity: 'incidencias.aulas',
      entityId: aulaId,
      metadata: { nombre: dto.nombre, activa: dto.activa }
    });

    return toAulaDto(row);
  }
}
