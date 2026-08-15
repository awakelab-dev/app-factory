import type { PrismaService } from '../../prisma/prisma.service';
import { daysBetween, formatDateOnly } from './incidencias-aula-dates';
import type {
  Aula,
  EstadoIncidencia,
  IncidenciaDetail,
  IncidenciaGravedad,
  IncidenciaRow,
  IncidenciaSeguimiento,
  IncidenciaTipo,
  ResumenMensual,
  ResumenMensualDetalleFila
} from './incidencias-aula.types';

// Formas mínimas de fila de Prisma que necesita cada mapper (evita acoplar
// este archivo al tipo generado completo — mismo patrón que
// gestor-proyectos.mappers.ts / orientador-ia.mappers.ts).

export interface AulaRow {
  id: string;
  nombre: string;
  activa: boolean;
  createdAt: Date;
}

export interface SeguimientoRow {
  id: string;
  incidenciaId: string;
  autorId: string;
  texto: string;
  createdAt: Date;
}

export interface IncidenciaBaseRow {
  id: string;
  alumnoNombre: string;
  aulaId: string;
  tipo: IncidenciaTipo;
  gravedad: IncidenciaGravedad;
  fechaHecho: Date;
  docenteId: string;
  estado: EstadoIncidencia;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncidenciaDetailRow extends IncidenciaBaseRow {
  relato: string;
  resolucion: string | null;
  cerradaAt: Date | null;
  cerradaPorId: string | null;
  seguimientos: SeguimientoRow[];
}

export function toAulaDto(row: AulaRow): Aula {
  return {
    id: row.id,
    nombre: row.nombre,
    activa: row.activa,
    createdAt: row.createdAt.toISOString()
  };
}

export function toSeguimientoDto(row: SeguimientoRow, names: ReadonlyMap<string, string>): IncidenciaSeguimiento {
  return {
    id: row.id,
    incidenciaId: row.incidenciaId,
    autorId: row.autorId,
    autorNombre: names.get(row.autorId) ?? null,
    texto: row.texto,
    createdAt: row.createdAt.toISOString()
  };
}

export function toIncidenciaRowDto(row: IncidenciaBaseRow, aulaNombre: string): IncidenciaRow {
  return {
    id: row.id,
    alumnoNombre: row.alumnoNombre,
    aulaId: row.aulaId,
    aulaNombre,
    tipo: row.tipo,
    gravedad: row.gravedad,
    fechaHecho: formatDateOnly(row.fechaHecho),
    docenteId: row.docenteId,
    estado: row.estado,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toIncidenciaDetailDto(
  row: IncidenciaDetailRow,
  aulaNombre: string,
  names: ReadonlyMap<string, string>,
  permissions: { canTomar: boolean; canAct: boolean }
): IncidenciaDetail {
  return {
    ...toIncidenciaRowDto(row, aulaNombre),
    relato: row.relato,
    resolucion: row.resolucion,
    cerradaAt: row.cerradaAt?.toISOString() ?? null,
    cerradaPorId: row.cerradaPorId,
    seguimientos: row.seguimientos.map((s) => toSeguimientoDto(s, names)),
    canTomar: permissions.canTomar,
    canAct: permissions.canAct
  };
}

/**
 * Lookup de nombres de `core.users` (join a nivel de aplicación, no FK de
 * base de datos — ver comentario en schema.prisma). Mismo patrón que
 * `resolveUserNames` de `gestor-proyectos.mappers.ts`: cada módulo es
 * autocontenido (D-011), así que se reimplementa aquí en vez de importarlo
 * cruzando carpetas de módulo.
 */
export async function resolveUserNames(prisma: PrismaService, ids: Iterable<string>): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, displayName: true }
  });
  return new Map(users.map((u) => [u.id, u.displayName]));
}

// ---------------------------------------------------------------------------
// Resumen mensual (Dirección) — minimización OBLIGATORIA de campos
// (gate funcional decisión 2 / gate técnico nota 5).
//
// `IncidenciaResumenRow` es una interfaz DISTINTA de `IncidenciaBaseRow`: NO
// tiene `alumnoNombre` ni forma de traer `relato`/`seguimientos`. El servicio
// de resumen (`IncidenciasResumenService`) hace su propio `select` de Prisma
// con exactamente estos campos — nunca trae la entidad completa para luego
// omitir columnas aquí. Este mapper, por construcción de tipos, no puede
// instanciar un campo identificativo aunque quisiera: no existe en `row`.
// ---------------------------------------------------------------------------

export interface IncidenciaResumenRow {
  id: string;
  aulaId: string;
  tipo: IncidenciaTipo;
  gravedad: IncidenciaGravedad;
  fechaHecho: Date;
  estado: EstadoIncidencia;
  createdAt: Date;
  cerradaAt: Date | null;
}

export function toResumenMensualDetalleFilaDto(
  row: IncidenciaResumenRow,
  aulaNombre: string
): ResumenMensualDetalleFila {
  return {
    id: row.id,
    aulaId: row.aulaId,
    aulaNombre,
    tipo: row.tipo,
    gravedad: row.gravedad,
    fechaHecho: formatDateOnly(row.fechaHecho),
    estado: row.estado,
    diasHastaCierre: row.estado === 'cerrada' && row.cerradaAt ? Math.round(daysBetween(row.createdAt, row.cerradaAt)) : null
  };
}

export function toResumenMensualDto(
  mes: string,
  rows: IncidenciaResumenRow[],
  aulaNames: ReadonlyMap<string, string>
): ResumenMensual {
  if (rows.length === 0) {
    return { mes, total: 0, abiertas: 0, gravedadAlta: 0, diasMediosHastaCierre: null, porTipo: [], porAula: [], detalle: [] };
  }

  const total = rows.length;
  const abiertas = rows.filter((r) => r.estado !== 'cerrada').length;
  const gravedadAlta = rows.filter((r) => r.gravedad === 'alta').length;

  const cierreDurations = rows
    .filter((r): r is IncidenciaResumenRow & { cerradaAt: Date } => r.estado === 'cerrada' && r.cerradaAt !== null)
    .map((r) => daysBetween(r.createdAt, r.cerradaAt));
  const diasMediosHastaCierre =
    cierreDurations.length === 0
      ? null
      : Math.round((cierreDurations.reduce((a, b) => a + b, 0) / cierreDurations.length) * 10) / 10;

  const tipoCounts = new Map<IncidenciaTipo, number>();
  const aulaCounts = new Map<string, number>();
  for (const row of rows) {
    tipoCounts.set(row.tipo, (tipoCounts.get(row.tipo) ?? 0) + 1);
    aulaCounts.set(row.aulaId, (aulaCounts.get(row.aulaId) ?? 0) + 1);
  }

  return {
    mes,
    total,
    abiertas,
    gravedadAlta,
    diasMediosHastaCierre,
    porTipo: [...tipoCounts.entries()].map(([tipo, count]) => ({ tipo, count })),
    porAula: [...aulaCounts.entries()].map(([aulaId, count]) => ({
      aulaId,
      aulaNombre: aulaNames.get(aulaId) ?? '—',
      count
    })),
    detalle: rows.map((row) => toResumenMensualDetalleFilaDto(row, aulaNames.get(row.aulaId) ?? '—'))
  };
}
