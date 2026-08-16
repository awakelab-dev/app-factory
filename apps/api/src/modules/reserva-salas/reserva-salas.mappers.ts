import { formatDateOnly } from './reserva-salas-franjas';
import type { Franja, Reserva, Sala } from './reserva-salas.types';

// Formas mínimas de fila de Prisma que necesita cada mapper (evita acoplar
// este archivo al tipo generado completo — mismo patrón que
// incidencias-aula.mappers.ts / gestor-proyectos.mappers.ts).

export interface SalaRow {
  id: string;
  nombre: string;
  capacidad: number;
  equipamiento: string | null;
  activa: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReservaRow {
  id: string;
  salaId: string;
  fecha: Date;
  hora: string;
  userId: string;
  personaNombre: string;
  motivo: string | null;
  createdAt: Date;
  canceladaAt: Date | null;
}

export function toSalaDto(row: SalaRow): Sala {
  return {
    id: row.id,
    nombre: row.nombre,
    capacidad: row.capacidad,
    equipamiento: row.equipamiento,
    activa: row.activa,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toReservaDto(row: ReservaRow, salaNombre: string): Reserva {
  return {
    id: row.id,
    salaId: row.salaId,
    salaNombre,
    fecha: formatDateOnly(row.fecha),
    hora: row.hora as Franja,
    userId: row.userId,
    personaNombre: row.personaNombre,
    motivo: row.motivo,
    createdAt: row.createdAt.toISOString(),
    canceladaAt: row.canceladaAt?.toISOString() ?? null
  };
}

/**
 * Nombre reducido para minimizar datos personales en la rejilla del
 * calendario (spec-funcional.md, flujo Empleado paso 3: "Nombre del
 * empleado (reducido: 'Javier', 'Ana') si está ocupada por otro") — solo el
 * primer nombre, nunca el apellido. Recepción ve `personaNombre` completo
 * (gestiona todas las reservas) — ver `reserva-salas-salas.service.ts#detail`.
 *
 * A diferencia de `incidencias-aula.mappers.ts#resolveUserNames`, este
 * módulo NO necesita un lookup a `core.users`: `personaNombre` ya llega
 * resuelto en el momento de crear la reserva (el nombre del propio empleado
 * sale de `AuthUser.displayName`, ya presente en el JWT — spec-tecnica.md
 * "Identidad de empleado" — o el texto libre que escribió Recepción para un
 * tercero), así que reducirlo es una operación puramente de texto.
 */
export function toShortLabel(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
