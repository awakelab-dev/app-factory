import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateOnly } from './incidencias-aula-dates';
import { IncidenciasPermissionsService } from './incidencias-aula-permissions.service';
import type { IncidenciaBaseRow, IncidenciaDetailRow } from './incidencias-aula.mappers';
import { resolveUserNames, toIncidenciaDetailDto, toIncidenciaRowDto } from './incidencias-aula.mappers';
import type {
  AddSeguimientoRequest,
  BandejaFiltros,
  CerrarIncidenciaRequest,
  CreateIncidenciaRequest,
  IncidenciaDetail,
  IncidenciaRow
} from './incidencias-aula.types';

/** Texto fijo de la entrada de seguimiento automática al tomar un caso
 * (spec-tecnica.md `POST .../tomar`) — igual redacción que el prototipo. */
const SEGUIMIENTO_TOMADO_TEXTO = 'Caso tomado por coordinación';

/**
 * Alta, consulta y ciclo de vida (tomar/seguimiento/cerrar) de incidencias.
 * Cada método revalida el permiso correspondiente con
 * `IncidenciasPermissionsService` — el `RolesGuard` del controller solo
 * decide si el ROL puede llegar al endpoint; la regla fina (¿es MI
 * incidencia?, ¿soy coordinación?) vive aquí (spec-tecnica.md "Reglas de
 * permiso por fila").
 */
@Injectable()
export class IncidenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: IncidenciasPermissionsService
  ) {}

  async create(user: AuthUser, dto: CreateIncidenciaRequest): Promise<IncidenciaRow> {
    const aula = await this.prisma.aula.findUnique({ where: { id: dto.aulaId } });
    if (!aula) throw new NotFoundException(`No existe el aula "${dto.aulaId}"`);

    const row = await this.prisma.incidencia.create({
      data: {
        alumnoNombre: dto.alumnoNombre,
        aulaId: dto.aulaId,
        tipo: dto.tipo,
        gravedad: dto.gravedad,
        fechaHecho: parseDateOnly(dto.fechaHecho),
        relato: dto.relato,
        docenteId: user.id
        // estado nace "abierta" (default de schema.prisma).
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'incidencias_aula.incidencia_creada',
      entity: 'incidencias.incidencias',
      entityId: row.id,
      metadata: { aulaId: row.aulaId, tipo: row.tipo, gravedad: row.gravedad }
    });

    return toIncidenciaRowDto(row, aula.nombre);
  }

  /** "Mis incidencias" del docente que hace la request — nunca las de otro. */
  async listMias(user: AuthUser): Promise<IncidenciaRow[]> {
    const rows = await this.prisma.incidencia.findMany({
      where: { docenteId: user.id },
      orderBy: { createdAt: 'desc' }
    });
    return this.toRowsWithAulaNames(rows);
  }

  /** Bandeja completa de coordinación (gate funcional, decisión 5: sin
   * partición — cualquier coordinación ve todo, no solo "sus" casos). */
  async bandeja(user: AuthUser, filtros: BandejaFiltros): Promise<IncidenciaRow[]> {
    if (!this.permissions.isCoordinacion(user)) {
      throw new ForbiddenException('No puedes ver la bandeja de incidencias');
    }

    const rows = await this.prisma.incidencia.findMany({
      where: { estado: filtros.estado, aulaId: filtros.aulaId },
      orderBy: { createdAt: 'desc' }
    });
    return this.toRowsWithAulaNames(rows);
  }

  /**
   * Detalle completo. Docente: 403 si no es su incidencia. Coordinación/admin:
   * cualquiera, y dispara auditoría de acceso (dato personal — spec-tecnica.md
   * "Auditoría"). Dirección NUNCA llega aquí (no está en `@Roles` del
   * controller ni pasa `canViewDetail`): su vista es `resumen-mensual`.
   */
  async detail(user: AuthUser, incidenciaId: string): Promise<IncidenciaDetail> {
    const row = await this.requireIncidenciaVisibleFor(user, incidenciaId);

    if (this.permissions.isCoordinacion(user)) {
      await this.audit.log({
        actorId: user.id,
        action: 'incidencias_aula.detalle_visto',
        entity: 'incidencias.incidencias',
        entityId: row.id
      });
    }

    return this.toDetailDto(user, row);
  }

  /** Pasa de "abierta" a "en_curso" y deja la primera entrada de seguimiento. */
  async tomar(user: AuthUser, incidenciaId: string): Promise<IncidenciaDetail> {
    if (!this.permissions.canAct(user)) throw new ForbiddenException('No puedes tomar casos');

    const row = await this.requireIncidencia(incidenciaId);
    if (row.estado !== 'abierta') {
      throw new BadRequestException('Solo se puede tomar una incidencia en estado "abierta"');
    }

    await this.prisma.incidencia.update({ where: { id: incidenciaId }, data: { estado: 'en_curso' } });
    await this.prisma.incidenciaSeguimiento.create({
      data: { incidenciaId, autorId: user.id, texto: SEGUIMIENTO_TOMADO_TEXTO }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'incidencias_aula.incidencia_tomada',
      entity: 'incidencias.incidencias',
      entityId: incidenciaId
    });

    return this.toDetailDto(user, await this.requireIncidencia(incidenciaId));
  }

  /** Entrada de seguimiento libre; si el estado era "abierta" pasa a "en_curso". */
  async addSeguimiento(user: AuthUser, incidenciaId: string, dto: AddSeguimientoRequest): Promise<IncidenciaDetail> {
    if (!this.permissions.canAct(user)) throw new ForbiddenException('No puedes añadir seguimiento');

    const row = await this.requireIncidencia(incidenciaId);
    if (row.estado === 'cerrada') {
      throw new BadRequestException('No se puede añadir seguimiento a una incidencia cerrada');
    }

    await this.prisma.incidenciaSeguimiento.create({
      data: { incidenciaId, autorId: user.id, texto: dto.texto }
    });
    if (row.estado === 'abierta') {
      await this.prisma.incidencia.update({ where: { id: incidenciaId }, data: { estado: 'en_curso' } });
    }

    return this.toDetailDto(user, await this.requireIncidencia(incidenciaId));
  }

  /** Exige `resolucion` no vacía (ya validado por Zod en el controller — esta
   * comprobación es una segunda capa en el servicio, gate técnico test (c):
   * el rechazo no puede depender solo del pipe HTTP). */
  async cerrar(user: AuthUser, incidenciaId: string, dto: CerrarIncidenciaRequest): Promise<IncidenciaDetail> {
    if (!this.permissions.canAct(user)) throw new ForbiddenException('No puedes cerrar incidencias');
    if (!dto.resolucion?.trim()) throw new BadRequestException('La resolución es obligatoria para cerrar una incidencia');

    const row = await this.requireIncidencia(incidenciaId);
    if (row.estado === 'cerrada') throw new BadRequestException('La incidencia ya está cerrada');

    await this.prisma.incidencia.update({
      where: { id: incidenciaId },
      data: { estado: 'cerrada', resolucion: dto.resolucion, cerradaAt: new Date(), cerradaPorId: user.id }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'incidencias_aula.incidencia_cerrada',
      entity: 'incidencias.incidencias',
      entityId: incidenciaId
    });

    return this.toDetailDto(user, await this.requireIncidencia(incidenciaId));
  }

  private async requireIncidencia(incidenciaId: string): Promise<IncidenciaDetailRow> {
    const row = await this.prisma.incidencia.findUnique({
      where: { id: incidenciaId },
      include: { seguimientos: true }
    });
    if (!row) throw new NotFoundException(`No existe la incidencia "${incidenciaId}"`);
    return row;
  }

  /** `requireIncidencia` + `canViewDetail` (403 si no es la propia incidencia
   * del docente que pregunta) — sin auditar (eso lo decide cada caller). */
  private async requireIncidenciaVisibleFor(user: AuthUser, incidenciaId: string): Promise<IncidenciaDetailRow> {
    const row = await this.requireIncidencia(incidenciaId);
    if (!this.permissions.canViewDetail(user, row)) {
      throw new ForbiddenException('No puedes ver el detalle de esta incidencia');
    }
    return row;
  }

  private async toDetailDto(user: AuthUser, row: IncidenciaDetailRow): Promise<IncidenciaDetail> {
    const [aula, names] = await Promise.all([
      this.prisma.aula.findUnique({ where: { id: row.aulaId } }),
      resolveUserNames(this.prisma, row.seguimientos.map((s) => s.autorId))
    ]);

    return toIncidenciaDetailDto(row, aula?.nombre ?? '—', names, {
      canTomar: this.permissions.canAct(user) && row.estado === 'abierta',
      canAct: this.permissions.canAct(user) && row.estado !== 'cerrada'
    });
  }

  private async toRowsWithAulaNames(rows: IncidenciaBaseRow[]): Promise<IncidenciaRow[]> {
    if (rows.length === 0) return [];
    const aulaIds = [...new Set(rows.map((r) => r.aulaId))];
    const aulas = await this.prisma.aula.findMany({ where: { id: { in: aulaIds } } });
    const names = new Map(aulas.map((a) => [a.id, a.nombre]));
    return rows.map((row) => toIncidenciaRowDto(row, names.get(row.aulaId) ?? '—'));
  }
}
