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
