import type { ProyectosTaskStatus } from './gestor-proyectos.types';

/** Orden fijo de columnas del kanban (5 estados, spec funcional). */
export const TASK_STATUS_COLUMNS: ProyectosTaskStatus[] = [
  'iniciada',
  'en_progreso',
  'en_pausa',
  'cancelada',
  'finalizada'
];

export const TASK_STATUS_LABEL: Record<ProyectosTaskStatus, string> = {
  iniciada: 'Iniciada',
  en_progreso: 'En progreso',
  en_pausa: 'En pausa',
  cancelada: 'Cancelada',
  finalizada: 'Finalizada'
};

/** Color de acento por columna/badge — tokens de marca Awakelab (cian/azul 2026). */
export const TASK_STATUS_ACCENT: Record<ProyectosTaskStatus, string> = {
  iniciada: 'border-awk-blue-600 text-awk-blue-200',
  en_progreso: 'border-awk-cyan-600 text-awk-cyan-300',
  en_pausa: 'border-amber-700 text-amber-400',
  cancelada: 'border-red-800 text-red-400',
  finalizada: 'border-emerald-700 text-emerald-400'
};
