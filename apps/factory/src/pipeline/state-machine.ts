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
  // pr_review → rejected: un cambio/módulo puede descartarse en la revisión de
  // PR (gate pr_review de primera clase, 2026-07-19), no solo pedir cambios.
  pr_review: ['staging', 'changes_requested', 'rejected'],
  changes_requested: ['generating'],
  // staging → analyzing: re-entrada del pipeline por request_change sobre un
  // módulo que aún se valida en staging (docs/04, "Mantenimiento").
  staging: ['manager_acceptance', 'analyzing'],
  // manager_acceptance → analyzing: re-entrada por request_change; → rejected:
  // el cambio puede descartarse también en la aceptación del gerente.
  manager_acceptance: ['deployed', 'changes_requested', 'rejected', 'analyzing'],
  // deployed → analyzing: re-entrada por request_change sobre un módulo YA en
  // producción. `Project.status` pasa a reflejar la iteración del cambio; lo
  // que está vivo en prod no se toca hasta mergear+promover de nuevo (modelo
  // ligero, decisión 2026-07-19). Deja de ser un estado terminal.
  deployed: ['analyzing'],
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
    const allowed = PROJECT_TRANSITIONS[from];
    const hint =
      allowed.length > 0
        ? `Desde "${from}" solo se puede pasar a: ${allowed.join(', ')}.`
        : `"${from}" es un estado final, no admite transiciones.`;
    super(`Transición de estado inválida: "${from}" → "${to}". ${hint}`);
    this.name = 'InvalidTransitionError';
  }
}

export function assertValidTransition(from: ProjectStatus, to: ProjectStatus): void {
  if (!PROJECT_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}
