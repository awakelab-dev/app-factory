import { z } from 'zod';

/**
 * Contratos (Zod) de `incidencias-aula` — espejo EXACTO de
 * `apps/api/src/modules/incidencias-aula/incidencias-aula.types.ts` (gate
 * técnico, nota VINCULANTE 1: prohibido tocar `@awk/types` en esta
 * generación, así que los esquemas quedan locales a cada lado, mismo patrón
 * que `gestor-proyectos`/`focus-flow`).
 */

export const incidenciaTipoSchema = z.enum([
  'convivencia',
  'retraso_reiterado',
  'material_danado',
  'ausencia_injustificada',
  'uso_indebido_dispositivos',
  'otro'
]);
export type IncidenciaTipo = z.infer<typeof incidenciaTipoSchema>;

export const incidenciaGravedadSchema = z.enum(['baja', 'media', 'alta']);
export type IncidenciaGravedad = z.infer<typeof incidenciaGravedadSchema>;

export const estadoIncidenciaSchema = z.enum(['abierta', 'en_curso', 'cerrada']);
export type EstadoIncidencia = z.infer<typeof estadoIncidenciaSchema>;

// ---------------------------------------------------------------------------
// Aulas
// ---------------------------------------------------------------------------

export const aulaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  activa: z.boolean(),
  createdAt: z.iso.datetime()
});
export type Aula = z.infer<typeof aulaSchema>;
export const aulasResponseSchema = z.array(aulaSchema);

export const createAulaRequestSchema = z.object({
  nombre: z.string().min(1).max(150)
});
export type CreateAulaRequest = z.infer<typeof createAulaRequestSchema>;

export const updateAulaRequestSchema = z.object({
  nombre: z.string().min(1).max(150).optional(),
  activa: z.boolean().optional()
});
export type UpdateAulaRequest = z.infer<typeof updateAulaRequestSchema>;

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------

export const incidenciaSeguimientoSchema = z.object({
  id: z.string(),
  incidenciaId: z.string(),
  autorId: z.string(),
  autorNombre: z.string().nullable(),
  texto: z.string(),
  createdAt: z.iso.datetime()
});
export type IncidenciaSeguimiento = z.infer<typeof incidenciaSeguimientoSchema>;

export const incidenciaRowSchema = z.object({
  id: z.string(),
  alumnoNombre: z.string(),
  aulaId: z.string(),
  aulaNombre: z.string(),
  tipo: incidenciaTipoSchema,
  gravedad: incidenciaGravedadSchema,
  fechaHecho: z.string(),
  docenteId: z.string(),
  estado: estadoIncidenciaSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});
export type IncidenciaRow = z.infer<typeof incidenciaRowSchema>;
export const incidenciasResponseSchema = z.array(incidenciaRowSchema);

/**
 * Fila de la BANDEJA de coordinación (mini-spec técnica, cambio 2) — espejo
 * exacto de `incidenciaBandejaRowSchema` del backend. EXTIENDE
 * `incidenciaRowSchema` sin modificarlo: `diasAbierta` solo existe aquí, no
 * en `IncidenciaRow` (que sigue usando `DocentePage` y el detalle).
 */
export const incidenciaBandejaRowSchema = incidenciaRowSchema.extend({
  diasAbierta: z.number().int()
});
export type IncidenciaBandejaRow = z.infer<typeof incidenciaBandejaRowSchema>;
export const incidenciasBandejaResponseSchema = z.array(incidenciaBandejaRowSchema);

export const incidenciaDetailSchema = incidenciaRowSchema.extend({
  relato: z.string(),
  resolucion: z.string().nullable(),
  cerradaAt: z.iso.datetime().nullable(),
  cerradaPorId: z.string().nullable(),
  seguimientos: z.array(incidenciaSeguimientoSchema),
  canTomar: z.boolean(),
  canAct: z.boolean()
});
export type IncidenciaDetail = z.infer<typeof incidenciaDetailSchema>;

export const createIncidenciaRequestSchema = z.object({
  alumnoNombre: z.string().min(1).max(200),
  aulaId: z.string().min(1),
  tipo: incidenciaTipoSchema,
  gravedad: incidenciaGravedadSchema,
  fechaHecho: z.string().min(1),
  relato: z.string().min(1).max(4000)
});
export type CreateIncidenciaRequest = z.infer<typeof createIncidenciaRequestSchema>;

export const addSeguimientoRequestSchema = z.object({
  texto: z.string().min(1).max(4000)
});
export type AddSeguimientoRequest = z.infer<typeof addSeguimientoRequestSchema>;

export const cerrarIncidenciaRequestSchema = z.object({
  resolucion: z.string().min(1).max(4000)
});
export type CerrarIncidenciaRequest = z.infer<typeof cerrarIncidenciaRequestSchema>;

// ---------------------------------------------------------------------------
// Resumen mensual (Dirección) — nunca incluye alumnoNombre/relato/seguimientos.
// ---------------------------------------------------------------------------

export const resumenMensualDetalleFilaSchema = z.object({
  id: z.string(),
  aulaId: z.string(),
  aulaNombre: z.string(),
  tipo: incidenciaTipoSchema,
  gravedad: incidenciaGravedadSchema,
  fechaHecho: z.string(),
  estado: estadoIncidenciaSchema,
  diasHastaCierre: z.number().int().nullable()
});
export type ResumenMensualDetalleFila = z.infer<typeof resumenMensualDetalleFilaSchema>;

export const resumenMensualSchema = z.object({
  mes: z.string(),
  total: z.number().int(),
  abiertas: z.number().int(),
  gravedadAlta: z.number().int(),
  diasMediosHastaCierre: z.number().nullable(),
  porTipo: z.array(z.object({ tipo: incidenciaTipoSchema, count: z.number().int() })),
  porAula: z.array(z.object({ aulaId: z.string(), aulaNombre: z.string(), count: z.number().int() })),
  detalle: z.array(resumenMensualDetalleFilaSchema)
});
export type ResumenMensual = z.infer<typeof resumenMensualSchema>;
