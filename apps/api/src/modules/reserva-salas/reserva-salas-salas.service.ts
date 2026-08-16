import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FRANJAS, parseDateOnly, todayDateOnly } from './reserva-salas-franjas';
import { ReservaSalasPermissionsService } from './reserva-salas-permissions.service';
import { toSalaDto, toShortLabel } from './reserva-salas.mappers';
import type { CreateSalaRequest, Sala, SalaDetail, UpdateSalaRequest } from './reserva-salas.types';

/**
 * Catálogo de salas (spec-tecnica.md "Endpoints"): alta/edición/baja lógica
 * SOLO Recepción; lectura para Empleado y Recepción. Baja LÓGICA
 * (`activa=false`), nunca `DELETE` — hay reservas que referencian la sala y
 * el historial de Recepción sigue mostrándolas (spec-funcional.md "Baja de
 * sala").
 */
@Injectable()
export class SalasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: ReservaSalasPermissionsService
  ) {}

  /**
   * Catálogo para la rejilla de "Reservar": solo activas por defecto (spec-
   * funcional.md "Baja de sala": las inactivas no aparecen en el
   * calendario). `todas=true` solo se honra si quien pregunta es Recepción
   * (pantalla de gestión del catálogo, `CatalogoSalasView.tsx`, que necesita
   * ver también las de baja para poder reactivarlas) — revalidado aquí, no
   * solo confiando en el query param del controller.
   */
  async listForUser(user: AuthUser, todas: boolean): Promise<Sala[]> {
    const includeInactive = todas && this.permissions.isRecepcion(user);
    const rows = await this.prisma.sala.findMany({
      where: includeInactive ? undefined : { activa: true },
      orderBy: { nombre: 'asc' }
    });
    return rows.map(toSalaDto);
  }

  async create(user: AuthUser, dto: CreateSalaRequest): Promise<Sala> {
    const clash = await this.prisma.sala.findUnique({ where: { nombre: dto.nombre } });
    if (clash) throw new BadRequestException(`Ya existe una sala con el nombre "${dto.nombre}"`);

    const row = await this.prisma.sala.create({
      data: { nombre: dto.nombre, capacidad: dto.capacidad, equipamiento: dto.equipamiento ?? null }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'reserva_salas.sala_creada',
      entity: 'reserva_salas.salas',
      entityId: row.id,
      metadata: { nombre: row.nombre, capacidad: row.capacidad }
    });

    return toSalaDto(row);
  }

  /** Renombrar/editar capacidad o equipamiento — nunca toca `activa` (eso es
   * `toggleActiva`, un endpoint aparte a propósito). */
  async update(user: AuthUser, salaId: string, dto: UpdateSalaRequest): Promise<Sala> {
    const exists = await this.prisma.sala.findUnique({ where: { id: salaId } });
    if (!exists) throw new NotFoundException(`No existe la sala "${salaId}"`);

    if (dto.nombre !== undefined && dto.nombre !== exists.nombre) {
      const clash = await this.prisma.sala.findUnique({ where: { nombre: dto.nombre } });
      if (clash) throw new BadRequestException(`Ya existe una sala con el nombre "${dto.nombre}"`);
    }

    const row = await this.prisma.sala.update({
      where: { id: salaId },
      data: { nombre: dto.nombre, capacidad: dto.capacidad, equipamiento: dto.equipamiento }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'reserva_salas.sala_actualizada',
      entity: 'reserva_salas.salas',
      entityId: salaId,
      metadata: { nombre: dto.nombre, capacidad: dto.capacidad, equipamiento: dto.equipamiento }
    });

    return toSalaDto(row);
  }

  /**
   * Baja/reactivación lógica (gate técnico, nota pendiente 2 — resuelta con
   * la recomendación explícita: "permitir con confirmación explícita"). NO
   * bloquea con 409 aunque existan reservas futuras sin cancelar: la
   * confirmación vive en el diálogo del frontend (`CatalogoSalasView.tsx`),
   * no en el backend. Nunca borra la fila ni sus reservas.
   */
  async toggleActiva(user: AuthUser, salaId: string): Promise<Sala> {
    const exists = await this.prisma.sala.findUnique({ where: { id: salaId } });
    if (!exists) throw new NotFoundException(`No existe la sala "${salaId}"`);

    const row = await this.prisma.sala.update({ where: { id: salaId }, data: { activa: !exists.activa } });

    await this.audit.log({
      actorId: user.id,
      action: 'reserva_salas.sala_toggle_activa',
      entity: 'reserva_salas.salas',
      entityId: salaId,
      metadata: { activa: row.activa }
    });

    return toSalaDto(row);
  }

  /**
   * Detalle de una sala + rejilla de franjas de un día concreto (usada por
   * `CalendarioView.tsx`). Minimización de datos personales (spec-funcional
   * "Flujo funcional (Empleado)", paso 3): para una franja ocupada por OTRO,
   * quien pregunta ve un nombre reducido (`toShortLabel`) salvo que sea
   * Recepción, que ve `personaNombre` completo porque gestiona todas las
   * reservas. Las franjas propias no llevan `ocupantePorLabel` (el frontend
   * ya sabe que son "Tuya" por `estado`), y las libres no llevan ninguno de
   * los dos campos identificativos — por construcción de tipos
   * (`franjaSlotSchema`), no por omisión manual en cada rama.
   */
  async detail(user: AuthUser, salaId: string, fecha: string = todayDateOnly()): Promise<SalaDetail> {
    const sala = await this.prisma.sala.findUnique({ where: { id: salaId } });
    if (!sala) throw new NotFoundException(`No existe la sala "${salaId}"`);

    const reservasDelDia = await this.prisma.reserva.findMany({
      where: { salaId, fecha: parseDateOnly(fecha), canceladaAt: null }
    });
    const porHora = new Map(reservasDelDia.map((r) => [r.hora, r]));

    const franjas = FRANJAS.map((hora) => {
      const reserva = porHora.get(hora);
      if (!reserva) return { hora, estado: 'libre' as const, reservaId: null, ocupantePorLabel: null };
      if (reserva.userId === user.id) {
        return { hora, estado: 'tuya' as const, reservaId: reserva.id, ocupantePorLabel: null };
      }
      const ocupantePorLabel = this.permissions.isRecepcion(user)
        ? reserva.personaNombre
        : toShortLabel(reserva.personaNombre);
      return { hora, estado: 'ocupada' as const, reservaId: null, ocupantePorLabel };
    });

    return { ...toSalaDto(sala), fecha, franjas };
  }
}
