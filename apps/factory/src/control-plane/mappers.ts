import type {
  FactoryGate,
  FactoryProjectDetail,
  FactoryProjectSummary,
  FactoryRun,
  FactorySpec
} from '@awk/types';
import type { GateStatus, GateType, ProjectSourceType, ProjectStatus, RunStatus, RunType } from '../pipeline/types';

/**
 * Prisma (Date, Json) → DTOs de @awk/types (ISO strings, arrays tipados).
 * Tipos de entrada estructurales a propósito: no acoplan el control plane a
 * la forma exacta del cliente generado (mismo criterio que pipeline/types.ts).
 */

interface GateRecord {
  id: string;
  createdAt: Date;
  gateType: string;
  status: string;
  reviewer: string | null;
  decisionNotes: string | null;
  decidedAt: Date | null;
}

interface SpecRecord {
  id: string;
  createdAt: Date;
  version: number;
  functionalContent: string;
  technicalContent: string;
  complexityScore: number | null;
  sensitivityFlags: unknown;
  reuseNotes: string | null;
  gates: GateRecord[];
}

interface RunRecord {
  id: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  runType: string;
  status: string;
  branchName: string | null;
  prUrl: string | null;
  outputSummary: string | null;
  errorMessage: string | null;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

interface ProjectRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  moduleSlug: string;
  displayName: string;
  requestedBy: string;
  sourceType: string;
  sourceRef: string;
  status: string;
}

/** El análisis escribe un array de strings (meta.json); cualquier otra cosa en la columna Json se descarta. */
function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function toGateDto(gate: GateRecord): FactoryGate {
  return {
    id: gate.id,
    createdAt: gate.createdAt.toISOString(),
    gateType: gate.gateType as GateType,
    status: gate.status as GateStatus,
    reviewer: gate.reviewer,
    decisionNotes: gate.decisionNotes,
    decidedAt: gate.decidedAt?.toISOString() ?? null
  };
}

export function toSpecDto(spec: SpecRecord): FactorySpec {
  return {
    id: spec.id,
    createdAt: spec.createdAt.toISOString(),
    version: spec.version,
    functionalContent: spec.functionalContent,
    technicalContent: spec.technicalContent,
    complexityScore: spec.complexityScore,
    sensitivityFlags: toStringArray(spec.sensitivityFlags),
    reuseNotes: spec.reuseNotes,
    gates: spec.gates.map(toGateDto)
  };
}

export function toRunDto(run: RunRecord): FactoryRun {
  return {
    id: run.id,
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    runType: run.runType as RunType,
    status: run.status as RunStatus,
    branchName: run.branchName,
    prUrl: run.prUrl,
    outputSummary: run.outputSummary,
    errorMessage: run.errorMessage,
    costUsd: run.costUsd,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens
  };
}

export function toProjectSummaryDto(project: ProjectRecord & { specs: SpecRecord[] }): FactoryProjectSummary {
  const latestSpec = project.specs[0] ?? null;
  const pendingGates = project.specs.flatMap((spec) => spec.gates).filter((gate) => gate.status === 'pending').length;
  return {
    id: project.id,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    moduleSlug: project.moduleSlug,
    displayName: project.displayName,
    requestedBy: project.requestedBy,
    sourceType: project.sourceType as ProjectSourceType,
    status: project.status as ProjectStatus,
    latestSpecVersion: latestSpec?.version ?? null,
    pendingGates
  };
}

export function toProjectDetailDto(
  project: ProjectRecord & { specs: SpecRecord[]; runs: RunRecord[] }
): FactoryProjectDetail {
  return {
    id: project.id,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    moduleSlug: project.moduleSlug,
    displayName: project.displayName,
    requestedBy: project.requestedBy,
    sourceType: project.sourceType as ProjectSourceType,
    status: project.status as ProjectStatus,
    sourceRef: project.sourceRef,
    specs: project.specs.map(toSpecDto),
    runs: project.runs.map(toRunDto)
  };
}
