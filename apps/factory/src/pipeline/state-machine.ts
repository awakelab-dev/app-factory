import type { ProjectStatus } from './types';

/**
 * Transiciones válidas del estado de un `Project` (docs/03-arquitectura.md,
 * "Estados del proyecto": Recibido → Analizando → Spec lista → Aprobación
 * pendiente → Generando → Verificando → PR en revisión → Staging →
 * Aceptación del gerente → Desplegado, + Rechazado/Cambios solicitados/Error).
 *
 * Única fuente de verdad de qué mueve a qué. Ningún servicio escribe
 * `project.status` directamente — todos pasan por
 * `ProjectsService.transition`, que llama a `assertValidTransition` primero.
 * Casos no obvios documentados inline.
 */
export const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  received: ['analyzing'],
  // spec_ready además de pending_approval: permite re-correr el análisis
  // (revisión de spec tras un gate "changes_requested", ver GatesService).
  analyzing: ['spec_ready', 'error'],
  spec_ready: ['pending_approval', 'analyzing'],
  // changes_requested aquí = un gate funcional/técnico pidió "complementar"
  // (docs/05) antes de llegar a generar: vuelve a spec_ready, no a un estado
  // "changes_requested" separado (ese lo reservamos para después del PR).
  pending_approval: ['generating', 'spec_ready', 'rejected'],
  generating: ['verifying', 'error'],
  // verifying → generating: el runner reintenta tras un fallo de build/test
  // (docs/04, paso 5, "Falla → el runner itera, máx. N" — el máximo de
  // reintentos lo aplica quien invoca, no la máquina de estados).
  verifying: ['pr_review', 'generating', 'error'],
  pr_review: ['staging', 'changes_requested'],
  changes_requested: ['generating'],
  staging: ['manager_acceptance'],
  manager_acceptance: ['deployed', 'changes_requested'],
  deployed: [],
  rejected: [],
  // error → generating: permite reintentar generación tras un fallo del Agent
  // SDK sin tener que rehacer el análisis (el spec aprobado sigue vigente).
  error: ['analyzing', 'generating']
};

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: ProjectStatus,
    public readonly to: ProjectStatus
  ) {
    super(`Transición de estado inválida: "${from}" → "${to}".`);
    this.name = 'InvalidTransitionError';
  }
}

export function assertValidTransition(from: ProjectStatus, to: ProjectStatus): void {
  if (!PROJECT_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}
