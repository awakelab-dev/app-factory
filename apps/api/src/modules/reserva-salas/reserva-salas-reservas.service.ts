import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { isPastDate, parseDateOnly, todayDateOnly } from './reserva-salas-franjas';
import { ReservaSalasPermissionsService } from './reserva-salas-permissions.service';
import type { ReservaRow } from './reserva-salas.mappers';
import { toReservaDto } from './reserva-salas.mappers';
import type { CreateReservaRequest, Reserva, ReservasFiltros } from './reserva-salas.types';

/**
 * Alta, consulta y cancelación de reservas (spec-tecnica.md "Endpoints").
 * Cada método revalida el permiso correspondiente con
 * `ReservaSalasPermissionsService` — el `RolesGuard` del controller solo
 * decide si el ROL puede llegar al endpoint; la regla fina ("¿es MI
 * reserva?", "¿soy Recepción?") vive aquí.
 */
@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: ReservaSalasPermissionsService
  ) {}

  /**
   * Crea una reserva (spec-tecnica.md, tabla de endpoints "POST /reservas").
   * Validaciones, en orden: sala existe y está activa, fecha no es pasada,
   * franja libre (409 si ya hay una reserva no cancelada para esa tupla).
   * `personaNombre`: Empleado siempre reserva a su propio nombre (el body
   * puede traer `personaNombre`, pero se ignora — nunca se confía en el
   * cliente para decidir a nombre de quién es la reserva); Recepción puede
   * indicar un tercero, con fallback a su propio nombre si lo omite.
   */
  async create(user: AuthUser, dto: CreateReservaRequest): Promise<Reserva> {
    const sala = await this.prisma.sala.findUnique({ where: { id: dto.salaId } });
    if (!sala) throw new NotFoundException(`No existe la sala "${dto.salaId}"`);
    if (!sala.activa) throw new BadRequestException('La sala no está disponible para reservar');
    if (isPastDate(dto.fecha)) throw new BadRequestException('No se pueden reservar fechas pasadas');

    const personaNombre = this.permissions.isRecepcion(user)
      ? dto.personaNombre?.trim() || user.displayName
      : user.displayName;

    const clash = await this.prisma.reserva.findFirst({
      where: { salaId: dto.salaId, fecha: parseDateOnly(dto.fecha), hora: dto.hora, canceladaAt: null }
    });
    if (clash) throw new ConflictException('Esa franja ya está reservada');

    const row = await this.prisma.reserva.create({
      data: {
        salaId: dto.salaId,
        fecha: parseDateOnly(dto.fecha),
        hora: dto.hora,
        userId: user.id,
        personaNombre,
        motivo: dto.motivo?.trim() || null
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'reserva_salas.reserva_creada',
      entity: 'reserva_salas.reservas',
      entityId: row.id,
      metadata: { salaId: row.salaId, fecha: dto.fecha, hora: dto.hora, personaNombre }
    });

    return toReservaDto(row, sala.nombre);
  }

  /** Empleado: solo las suyas (`userId` = usuario actual); Recepción: todas
   * (spec-tecnica.md, tabla de endpoints "GET /reservas"). */
  async list(user: AuthUser, filtros: ReservasFiltros): Promise<Reserva[]> {
    const desde = this.resolveDesde(user, filtros.desde);
    const where = this.permissions.isRecepcion(user)
      ? { fecha: { gte: parseDateOnly(desde) } }
      : { userId: user.id, fecha: { gte: parseDateOnly(desde) } };

    const rows = await this.prisma.reserva.findMany({ where, orderBy: [{ fecha: 'asc' as const }, { hora: 'asc' as const }] });
    return this.toRowsWithSalaNames(rows);
  }

  /** Soft delete (spec-tecnica.md "Modelo de datos": `cancelada_at`, nunca
   * se borra la fila). Empleado: solo si es su propia reserva; Recepción:
   * cualquiera. */
  async cancel(user: AuthUser, reservaId: string): Promise<void> {
    const row = await this.prisma.reserva.findUnique({ where: { id: reservaId } });
    if (!row) throw new NotFoundException(`No existe la reserva "${reservaId}"`);
    if (row.canceladaAt) throw new BadRequestException('La reserva ya está cancelada');
    if (!this.permissions.canCancel(user, row)) throw new ForbiddenException('No puedes cancelar esta reserva');

    await this.prisma.reserva.update({ where: { id: reservaId }, data: { canceladaAt: new Date() } });

    await this.audit.log({
      actorId: user.id,
      action: 'reserva_salas.reserva_cancelada',
      entity: 'reserva_salas.reservas',
      entityId: reservaId
    });
  }

  /** Empleado: nunca antes de hoy, aunque intente forzar `?desde=` en el
   * pasado (spec-funcional.md "Fechas pasadas": "el date picker del
   * frontend deshabilita" — esta es la revalidación en el backend). Recepción:
   * se respeta tal cual, historial open-ended; por defecto hoy si no se indica. */
  private resolveDesde(user: AuthUser, desde: string | undefined): string {
    const hoy = todayDateOnly();
    if (!desde) return hoy;
    if (this.permissions.isRecepcion(user)) return desde;
    return desde < hoy ? hoy : desde;
  }

  private async toRowsWithSalaNames(rows: ReservaRow[]): Promise<Reserva[]> {
    if (rows.length === 0) return [];
    const salaIds = [...new Set(rows.map((r) => r.salaId))];
    const salas = await this.prisma.sala.findMany({ where: { id: { in: salaIds } } });
    const names = new Map(salas.map((s) => [s.id, s.nombre]));
    return rows.map((row) => toReservaDto(row, names.get(row.salaId) ?? '—'));
  }
}
