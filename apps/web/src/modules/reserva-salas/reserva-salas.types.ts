import { z } from 'zod';
import { FRANJAS } from './reserva-salas-franjas';

/**
 * Contratos (Zod) de `reserva-salas` — espejo EXACTO de
 * `apps/api/src/modules/reserva-salas/reserva-salas.types.ts` (gate técnico,
 * nota VINCULANTE: prohibido tocar `@awk/types` en este paso de generación,
 * así que los esquemas quedan locales a cada módulo, mismo patrón que
 * `gestor-proyectos`/`focus-flow`/`incidencias-aula`).
 */

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato YYYY-MM-DD)');

export const franjaSchema = z.enum(FRANJAS);
export type Franja = z.infer<typeof franjaSchema>;

// ---------------------------------------------------------------------------
// Salas
// ---------------------------------------------------------------------------

export const salaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  capacidad: z.number().int(),
  equipamiento: z.string().nullable(),
  activa: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});
export type Sala = z.infer<typeof salaSchema>;
export const salasResponseSchema = z.array(salaSchema);

export const createSalaRequestSchema = z.object({
  nombre: z.string().min(1).max(150),
  capacidad: z.number().int().min(1),
  equipamiento: z.string().max(300).optional()
});
export type CreateSalaRequest = z.infer<typeof createSalaRequestSchema>;

export const updateSalaRequestSchema = z.object({
  nombre: z.string().min(1).max(150).optional(),
  capacidad: z.number().int().min(1).optional(),
  equipamiento: z.string().max(300).nullable().optional()
});
export type UpdateSalaRequest = z.infer<typeof updateSalaRequestSchema>;

// ---------------------------------------------------------------------------
// Rejilla de una sala para un día (GET /salas/:id) — usada por CalendarioView.
// ---------------------------------------------------------------------------

export const franjaEstadoSchema = z.enum(['libre', 'tuya', 'ocupada']);
export type FranjaEstado = z.infer<typeof franjaEstadoSchema>;

export const franjaSlotSchema = z.object({
  hora: franjaSchema,
  estado: franjaEstadoSchema,
  reservaId: z.string().nullable(),
  ocupantePorLabel: z.string().nullable()
});
export type FranjaSlot = z.infer<typeof franjaSlotSchema>;

export const salaDetailSchema = salaSchema.extend({
  fecha: dateOnlySchema,
  franjas: z.array(franjaSlotSchema)
});
export type SalaDetail = z.infer<typeof salaDetailSchema>;

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------

export const reservaSchema = z.object({
  id: z.string(),
  salaId: z.string(),
  salaNombre: z.string(),
  fecha: dateOnlySchema,
  hora: franjaSchema,
  userId: z.string(),
  personaNombre: z.string(),
  motivo: z.string().nullable(),
  createdAt: z.iso.datetime(),
  canceladaAt: z.iso.datetime().nullable()
});
export type Reserva = z.infer<typeof reservaSchema>;
export const reservasResponseSchema = z.array(reservaSchema);

export const createReservaRequestSchema = z.object({
  salaId: z.string().min(1),
  fecha: dateOnlySchema,
  hora: franjaSchema,
  motivo: z.string().max(500).optional(),
  personaNombre: z.string().max(200).optional()
});
export type CreateReservaRequest = z.infer<typeof createReservaRequestSchema>;
