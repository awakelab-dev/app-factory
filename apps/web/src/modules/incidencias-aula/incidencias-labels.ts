import type { EstadoIncidencia, IncidenciaGravedad, IncidenciaTipo } from './incidencias-aula.types';

export const TIPO_LABEL: Record<IncidenciaTipo, string> = {
  convivencia: 'Convivencia',
  retraso_reiterado: 'Retraso reiterado',
  material_danado: 'Material dañado',
  ausencia_injustificada: 'Ausencia sin justificar',
  uso_indebido_dispositivos: 'Uso indebido de dispositivos',
  otro: 'Otro'
};

export const GRAVEDAD_LABEL: Record<IncidenciaGravedad, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta'
};

export const GRAVEDAD_ACCENT: Record<IncidenciaGravedad, string> = {
  baja: 'border-awk-blue-600 text-awk-blue-200',
  media: 'border-amber-600 text-amber-300',
  alta: 'border-red-600 text-red-400'
};

export const ESTADO_LABEL: Record<EstadoIncidencia, string> = {
  abierta: 'Abierta',
  en_curso: 'En curso',
  cerrada: 'Cerrada'
};

export const ESTADO_ACCENT: Record<EstadoIncidencia, string> = {
  abierta: 'border-red-600 text-red-400',
  en_curso: 'border-amber-600 text-amber-300',
  cerrada: 'border-awk-cyan-600 text-awk-cyan-300'
};

/**
 * Umbral (días naturales) a partir del cual una incidencia `abierta`/
 * `en_curso` se marca como estancada en la bandeja de coordinación
 * (mini-spec técnica, cambio 2). Único lugar donde vive el "7" — gate
 * funcional, condición 5 VINCULANTE: nada de repetir el número en la página
 * y en un test.
 */
export const DIAS_ALERTA_ESTANCAMIENTO = 7;
