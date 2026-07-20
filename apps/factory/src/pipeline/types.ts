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
