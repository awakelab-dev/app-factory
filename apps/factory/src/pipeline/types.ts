/**
 * Tipos del pipeline como uniones de string literal, no como el enum
 * generado por Prisma (mismo criterio que `@awk/types` en la Plataforma:
 * apps/api/src/modules/orientador-ia importa sus enums desde `@awk/types`,
 * no desde `generated/prisma`, para no acoplar la lógica de negocio a la
 * forma exacta del cliente generado). Los valores coinciden 1:1 con los
 * enums de prisma/schema.prisma — si cambian ahí, cambian aquí.
 */

export type ProjectStatus =
  | 'received'
  | 'analyzing'
  | 'spec_ready'
  | 'pending_approval'
  | 'generating'
  | 'verifying'
  | 'pr_review'
  | 'staging'
  | 'manager_acceptance'
  | 'deployed'
  | 'changes_requested'
  | 'rejected'
  | 'error';

export type ProjectSourceType = 'manual' | 'cowork_prototype';

export type GateType = 'functional' | 'technical' | 'pr_review' | 'manager_acceptance';

export type GateStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export type GateDecision = Extract<GateStatus, 'approved' | 'rejected' | 'changes_requested'>;

export type RunType = 'analysis' | 'generation';

export type RunStatus = 'pending' | 'running' | 'success' | 'error';

export type FactoryActorRole = 'gerente' | 'admin';

/**
 * Tipo de trabajo encolado (D-047, ampliado en D3). Ver `AnalysisJob` en
 * schema.prisma. Los dos primeros los consume el worker de análisis; los dos
 * últimos, el de generación (`FACTORY_WORKER_KINDS`).
 */
export type AnalysisJobKind = 'analysis' | 'change_analysis' | 'generation' | 'pr_merge';

/** Los kinds que exigen un checkout con toolchain y credencial de push (D3). */
export const GENERATION_JOB_KINDS: readonly AnalysisJobKind[] = ['generation', 'pr_merge'];

export function isGenerationKind(kind: AnalysisJobKind): boolean {
  return GENERATION_JOB_KINDS.includes(kind);
}

export type AnalysisJobStatus = 'queued' | 'running' | 'success' | 'error';

/**
 * Fila de `analysis_jobs`. Se declara a mano (no se importa del cliente
 * generado) por el mismo criterio que el resto de este archivo, y además
 * porque `claimNext`/`reapStale` usan `$queryRaw` y necesitan tipar el
 * RETURNING sin depender de la forma exacta del cliente.
 */
export interface AnalysisJobRow {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  kind: AnalysisJobKind;
  projectId: string;
  changeRequestId: string | null;
  /** Spec a generar/mergear (kinds de D3); null en los kinds de análisis. */
  specId: string | null;
  status: AnalysisJobStatus;
  attempts: number;
  /** Hora a partir de la cual el trabajo vuelve a ser tomable (backoff, D3). */
  nextAttemptAt: Date | null;
  requestedBy: string;
  workerId: string | null;
  claimedAt: Date | null;
  heartbeatAt: Date | null;
  finishedAt: Date | null;
  runId: string | null;
  errorMessage: string | null;
}

/**
 * Actor autenticado que ejecuta una operación de la Fábrica (D-036): sale
 * del PAT (tabla factory_actors) o del JWT de plataforma con rol admin.
 * Los servicios del pipeline lo reciben como parámetro OPCIONAL: sin actor
 * (CLI, operado por Leonardo) no se aplica scope — con actor `gerente` se
 * restringe a SUS proyectos y a los gates functional/manager_acceptance.
 */
export interface FactoryActorContext {
  email: string;
  role: FactoryActorRole;
}
