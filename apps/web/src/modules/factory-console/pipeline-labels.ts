import type {
  FactoryAnalysisJobKind,
  FactoryAnalysisJobStatus,
  FactoryGateStatus,
  FactoryGateType,
  FactoryProjectStatus,
  FactoryRunStatus
} from '@awk/types';

/**
 * Etiquetas y presentación de los estados del pipeline (docs/03,
 * "Estados del proyecto"). El "camino feliz" ordenado alimenta el stepper del
 * detalle; los estados de desvío (changes_requested/rejected/error) se pintan
 * como alerta sobre el paso en que ocurrieron, no como pasos propios.
 */

export const HAPPY_PATH: FactoryProjectStatus[] = [
  'received',
  'analyzing',
  'spec_ready',
  'pending_approval',
  'generating',
  'verifying',
  'pr_review',
  'staging',
  'manager_acceptance',
  'deployed'
];

export const PROJECT_STATUS_LABEL: Record<FactoryProjectStatus, string> = {
  received: 'Recibido',
  analyzing: 'Analizando',
  spec_ready: 'Spec lista',
  pending_approval: 'Pendiente de aprobación',
  generating: 'Generando',
  verifying: 'Verificando',
  pr_review: 'Revisión de PR',
  staging: 'En staging',
  manager_acceptance: 'Aceptación del gerente',
  deployed: 'Desplegado',
  changes_requested: 'Cambios solicitados',
  rejected: 'Rechazado',
  error: 'Error'
};

/** Clases del badge de estado (paleta Awakelab: cian = activo, azul = neutro). */
export function statusBadgeClass(status: FactoryProjectStatus): string {
  if (status === 'deployed') return 'bg-awk-cyan-900/40 text-awk-cyan-300 border border-awk-cyan-700';
  if (status === 'rejected' || status === 'error') return 'bg-red-950 text-red-400 border border-red-800';
  if (status === 'changes_requested') return 'bg-amber-950 text-amber-400 border border-amber-800';
  return 'bg-awk-blue-800 text-awk-cyan-300 border border-awk-blue-700';
}

export const GATE_TYPE_LABEL: Record<FactoryGateType, string> = {
  functional: 'Gate funcional (gerente)',
  technical: 'Gate técnico (revisor)',
  pr_review: 'Revisión de PR',
  manager_acceptance: 'Aceptación en staging'
};

export const GATE_STATUS_LABEL: Record<FactoryGateStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  changes_requested: 'Cambios solicitados'
};

export const RUN_STATUS_LABEL: Record<FactoryRunStatus, string> = {
  pending: 'pendiente',
  running: 'en curso',
  success: 'ok',
  error: 'error'
};

/**
 * Cola de la Fábrica (`analysis_jobs`, D-047). Se muestra desde el incremento D
 * (bloque 5): hasta entonces, si un análisis no arrancaba o moría, el proyecto
 * "no avanzaba" y el único diagnóstico era `docker compose logs` por SSH.
 */
export const ANALYSIS_JOB_KIND_LABEL: Record<FactoryAnalysisJobKind, string> = {
  analysis: 'Análisis del prototipo',
  change_analysis: 'Análisis del cambio'
};

export const ANALYSIS_JOB_STATUS_LABEL: Record<FactoryAnalysisJobStatus, string> = {
  queued: 'en cola',
  running: 'en curso',
  success: 'completado',
  error: 'fallido'
};

export function jobBadgeClass(status: FactoryAnalysisJobStatus): string {
  if (status === 'error') return 'bg-red-950 text-red-400 border border-red-800';
  if (status === 'success') return 'bg-awk-blue-800 text-awk-cyan-300 border border-awk-blue-700';
  if (status === 'running') return 'bg-awk-cyan-500 text-awk-navy-900 border border-awk-cyan-500';
  return 'bg-awk-navy-800 text-awk-blue-300 border border-awk-blue-700';
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
