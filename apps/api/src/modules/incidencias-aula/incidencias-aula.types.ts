import { z } from 'zod';

/**
 * Contratos (Zod) de `incidencias-aula`.
 *
 * Nota de gate técnico (VINCULANTE): la spec técnica original proponía
 * exportar estos enums/DTOs desde `@awk/types`, pero ese paquete es un punto
 * de integración compartido entre módulos generados en paralelo y este paso
 * de generación SOLO puede escribir dentro de las carpetas de su propio
 * módulo (docs/04, paso 4). Los esquemas quedan, por tanto, LOCALES a este
 * módulo (aquí y en su espejo `apps/web/.../incidencias-aula.types.ts`) —
 * mismo patrón ya vigente en `gestor-proyectos`/`focus-flow`. Consolidar en
 * `@awk/types` (si se decide) es tarea de un paso posterior del pipeline.
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
// Aulas (gate funcional, decisión 4: catálogo editable solo-admin)
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

export const updateAulaRequestSchema = z
  .object({
    nombre: z.string().min(1).max(150).optional(),
    activa: z.boolean().optional()
  })
  .refine((v) => v.nombre !== undefined || v.activa !== undefined, {
    message: 'Debe indicar al menos "nombre" o "activa"'
  });
export type UpdateAulaRequest = z.infer<typeof updateAulaRequestSchema>;

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------

export const incidenciaSeguimientoSchema = z.object({
  id: z.string(),
  incidenciaId: z.string(),
  autorId: z.string(),
  /** Resuelto vía lookup a `core.users` (aplicación, no FK) — null si no se encontró. */
  autorNombre: z.string().nullable(),
  texto: z.string(),
  createdAt: z.iso.datetime()
});
export type IncidenciaSeguimiento = z.infer<typeof incidenciaSeguimientoSchema>;

/** Fila ligera para listas (mías / bandeja) — sin relato ni seguimientos. */
export const incidenciaRowSchema = z.object({
  id: z.string(),
  alumnoNombre: z.string(),
  aulaId: z.string(),
  aulaNombre: z.string(),
  tipo: incidenciaTipoSchema,
  gravedad: incidenciaGravedadSchema,
  /** `YYYY-MM-DD`. */
  fechaHecho: z.string(),
  docenteId: z.string(),
  estado: estadoIncidenciaSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});
export type IncidenciaRow = z.infer<typeof incidenciaRowSchema>;
export const incidenciasResponseSchema = z.array(incidenciaRowSchema);

/**
 * Detalle completo: alumno, relato y línea de tiempo de seguimiento. NUNCA es
 * la forma que ve Dirección (ver `ResumenMensual` más abajo, que se construye
 * con un mapper propio que no toca ninguno de estos campos identificativos).
 * `canTomar`/`canAct` son la matriz de permisos de ESTA incidencia PARA quien
 * hace la request, calculada en el backend (mismo criterio que
 * `gestorTaskPermissionsSchema` de `gestor-proyectos`) — el frontend la usa
 * solo para pintar/ocultar botones; cada acción se revalida en su endpoint.
 */
export const incidenciaDetailSchema = incidenciaRowSchema.extend({
  relato: z.string(),
  resolucion: z.string().nullable(),
  cerradaAt: z.iso.datetime().nullable(),
  cerradaPorId: z.string().nullable(),
  seguimientos: z.array(incidenciaSeguimientoSchema),
  /** Tomar el caso: solo si es coordinación/admin Y el estado es "abierta". */
  canTomar: z.boolean(),
  /** Seguimiento/cerrar: solo si es coordinación/admin Y el estado no es "cerrada". */
  canAct: z.boolean()
});
export type IncidenciaDetail = z.infer<typeof incidenciaDetailSchema>;

export const createIncidenciaRequestSchema = z.object({
  alumnoNombre: z.string().min(1).max(200),
  aulaId: z.string().min(1),
  tipo: incidenciaTipoSchema,
  gravedad: incidenciaGravedadSchema,
  /** `YYYY-MM-DD`. */
  fechaHecho: z.string().min(1),
  relato: z.string().min(1).max(4000)
});
export type CreateIncidenciaRequest = z.infer<typeof createIncidenciaRequestSchema>;

export const addSeguimientoRequestSchema = z.object({
  texto: z.string().min(1).max(4000)
});
export type AddSeguimientoRequest = z.infer<typeof addSeguimientoRequestSchema>;

/** `resolucion` no vacía — validado aquí (Zod, en el pipe del controller) Y
 * de nuevo en el servicio (defensa en profundidad, ver
 * `IncidenciasService.cerrar`): el prototipo ya bloqueaba el cierre sin
 * resolución en cliente, pero la plataforma nunca confía solo en eso
 * (gate técnico, test exigido (c)). */
export const cerrarIncidenciaRequestSchema = z.object({
  resolucion: z.string().min(1).max(4000)
});
export type CerrarIncidenciaRequest = z.infer<typeof cerrarIncidenciaRequestSchema>;

export const bandejaFiltrosSchema = z.object({
  estado: estadoIncidenciaSchema.optional(),
  aulaId: z.string().optional()
});
export type BandejaFiltros = z.infer<typeof bandejaFiltrosSchema>;

// ---------------------------------------------------------------------------
// Resumen mensual (Dirección) — minimización de campos OBLIGATORIA
// (gate funcional decisión 2 / gate técnico nota 5): esta forma NUNCA incluye
// alumnoNombre, relato ni seguimientos — ni aquí en el contrato ni en el
// mapper del backend, que ni siquiera los selecciona de la base de datos.
// ---------------------------------------------------------------------------

export const resumenMensualDetalleFilaSchema = z.object({
  id: z.string(),
  aulaId: z.string(),
  aulaNombre: z.string(),
  tipo: incidenciaTipoSchema,
  gravedad: incidenciaGravedadSchema,
  fechaHecho: z.string(),
  estado: estadoIncidenciaSchema,
  /** Días naturales entre el registro y el cierre; null si sigue abierta/en curso. */
  diasHastaCierre: z.number().int().nullable()
});
export type ResumenMensualDetalleFila = z.infer<typeof resumenMensualDetalleFilaSchema>;

export const resumenMensualDistribucionTipoSchema = z.object({
  tipo: incidenciaTipoSchema,
  count: z.number().int()
});
export const resumenMensualDistribucionAulaSchema = z.object({
  aulaId: z.string(),
  aulaNombre: z.string(),
  count: z.number().int()
});

export const resumenMensualSchema = z.object({
  /** `YYYY-MM`. */
  mes: z.string(),
  total: z.number().int(),
  abiertas: z.number().int(),
  gravedadAlta: z.number().int(),
  diasMediosHastaCierre: z.number().nullable(),
  porTipo: z.array(resumenMensualDistribucionTipoSchema),
  porAula: z.array(resumenMensualDistribucionAulaSchema),
  detalle: z.array(resumenMensualDetalleFilaSchema)
});
export type ResumenMensual = z.infer<typeof resumenMensualSchema>;
