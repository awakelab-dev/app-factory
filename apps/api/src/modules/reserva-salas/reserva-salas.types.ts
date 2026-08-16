import { z } from 'zod';
import { FRANJAS } from './reserva-salas-franjas';

/**
 * Contratos (Zod) de `reserva-salas`.
 *
 * Nota de gate técnico (VINCULANTE, mismo criterio que `incidencias-aula` y
 * `gestor-proyectos`/`focus-flow`): la spec técnica original proponía
 * exportar estos enums/DTOs desde `@awk/types`, pero ese paquete es un punto
 * de integración compartido entre módulos generados en paralelo y este paso
 * de generación SOLO puede escribir dentro de las carpetas de su propio
 * módulo (docs/04, paso 4). Los esquemas quedan, por tanto, LOCALES a este
 * módulo (aquí y en su espejo `apps/web/.../reserva-salas.types.ts`).
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

/** `PUT /salas/:id` (spec-tecnica.md): edita nombre/capacidad/equipamiento —
 * todos opcionales para permitir editar un solo campo, pero al menos uno
 * debe venir (si no, no hay nada que editar). La baja lógica va por su
 * propio endpoint (`PATCH .../toggle-activa`), nunca por aquí. */
export const updateSalaRequestSchema = z
  .object({
    nombre: z.string().min(1).max(150).optional(),
    capacidad: z.number().int().min(1).optional(),
    equipamiento: z.string().max(300).nullable().optional()
  })
  .refine((v) => v.nombre !== undefined || v.capacidad !== undefined || v.equipamiento !== undefined, {
    message: 'Debe indicar al menos "nombre", "capacidad" o "equipamiento"'
  });
export type UpdateSalaRequest = z.infer<typeof updateSalaRequestSchema>;

// ---------------------------------------------------------------------------
// Rejilla de una sala para un día (GET /salas/:id) — minimización de datos
// personales (spec-funcional.md, flujo Empleado paso 3): `ocupantePorLabel`
// nunca lleva apellido para quien NO es Recepción ni el dueño de la reserva
// (ver `reserva-salas-salas.service.ts#detail`). Por construcción de tipos
// esta forma no puede llevar `motivo` ni `userId` de terceros: la rejilla
// solo necesita saber si una franja está libre/es tuya/está ocupada.
// ---------------------------------------------------------------------------

export const franjaEstadoSchema = z.enum(['libre', 'tuya', 'ocupada']);
export type FranjaEstado = z.infer<typeof franjaEstadoSchema>;

export const franjaSlotSchema = z.object({
  hora: franjaSchema,
  estado: franjaEstadoSchema,
  /** Solo presente si `estado === 'tuya'` — permite cancelar sin una segunda consulta. */
  reservaId: z.string().nullable(),
  /** Solo presente si `estado === 'ocupada'`; nombre reducido salvo para Recepción. */
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
  /** A nombre de quién es la reserva — texto libre (spec-tecnica.md
   * "Justificación de persona_nombre"), no siempre coincide con quien la
   * registró (`userId`) cuando Recepción reserva para un tercero. */
  personaNombre: z.string(),
  motivo: z.string().nullable(),
  createdAt: z.iso.datetime(),
  /** `null` = activa; soft delete, nunca se borra la fila (spec-tecnica.md "Auditoría"). */
  canceladaAt: z.iso.datetime().nullable()
});
export type Reserva = z.infer<typeof reservaSchema>;
export const reservasResponseSchema = z.array(reservaSchema);

export const createReservaRequestSchema = z.object({
  salaId: z.string().min(1),
  fecha: dateOnlySchema,
  hora: franjaSchema,
  motivo: z.string().max(500).optional(),
  /** Ignorado si quien reserva es Empleado (spec-tecnica.md, tabla de
   * endpoints "POST /reservas"): solo Recepción puede reservar a nombre de
   * un tercero. Revalidado en el servicio, no solo aquí. */
  personaNombre: z.string().max(200).optional()
});
export type CreateReservaRequest = z.infer<typeof createReservaRequestSchema>;

export const reservasFiltrosSchema = z.object({
  desde: dateOnlySchema.optional()
});
export type ReservasFiltros = z.infer<typeof reservasFiltrosSchema>;
