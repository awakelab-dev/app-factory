import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';
import type { GateDecision, GateType, ProjectStatus } from './types';

export interface GateDecisionInput {
  gateId: string;
  decision: GateDecision;
  reviewer: string;
  notes?: string;
}

/**
 * Decide un gate (docs/05-gobernanza-seguridad.md: el revisor tiene tres
 * salidas — aprobar, rechazar con motivo, o "complementar") y aplica la
 * transición de proyecto que corresponda. `changes_requested` cubre
 * "complementar": nunca parchea código/spec a mano, vuelve el proyecto a
 * `spec_ready` para que un dev edite los archivos y corra `analyze` de
 * nuevo (crea la siguiente versión de spec + gates frescos).
 *
 * Fase 1 (docs/06: "lanzado por un dev", sin cola de trabajos): aprobar los
 * gates funcional+técnico NO dispara la generación automáticamente — eso lo
 * decide un dev explícitamente con el comando `generate`, que a su vez exige
 * (`GenerationRunnerService`) que ambos gates estén `approved`.
 */
@Injectable()
export class GatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService
  ) {}

  /** Abre un gate por cada tipo pedido para una spec recién creada (ver AnalysisRunnerService). */
  async openGatesForSpec(specId: string, gateTypes: GateType[]) {
    return this.prisma.$transaction(gateTypes.map((gateType) => this.prisma.gate.create({ data: { specId, gateType } })));
  }

  async decide(input: GateDecisionInput) {
    const gate = await this.prisma.gate.findUniqueOrThrow({
      where: { id: input.gateId },
      include: { spec: { include: { project: true } } }
    });

    if (gate.status !== 'pending') {
      throw new BadRequestException(`El gate ${gate.id} ya fue decidido (estado actual: ${gate.status}).`);
    }

    const projectId = gate.spec.project.id;
    const currentStatus = gate.spec.project.status as ProjectStatus;
    // gateType functional/technical + approved: sin transición automática
    // (target undefined), ver comentario de clase arriba.
    const target: ProjectStatus | undefined =
      input.decision === 'rejected'
        ? 'rejected'
        : input.decision === 'changes_requested'
          ? 'spec_ready'
          : gate.gateType === 'pr_review'
            ? 'staging'
            : gate.gateType === 'manager_acceptance'
              ? 'deployed'
              : undefined;

    // La transición va ANTES de escribir el gate (mismo criterio que los
    // runners): si es inválida, la request falla SIN dejar un gate decidido
    // con el proyecto a medias. Idempotencia: si otro gate de la misma spec
    // ya llevó el proyecto al estado objetivo (p. ej. rechazar el gate
    // técnico con el proyecto ya `rejected` por el funcional), se registra
    // la decisión sin re-transicionar (bug encontrado en la validación
    // end-to-end del 2026-07-17: HTTP 400 al rechazar el segundo gate).
    if (target && currentStatus !== target) {
      await this.projects.transition(projectId, target);
    }

    const updated = await this.prisma.gate.update({
      where: { id: input.gateId },
      data: {
        status: input.decision,
        reviewer: input.reviewer,
        decisionNotes: input.notes,
        decidedAt: new Date()
      }
    });

    return updated;
  }

  /** `true` solo si TODOS los gateTypes pedidos existen para la spec y están `approved`. */
  async areSpecGatesApproved(specId: string, gateTypes: GateType[]): Promise<boolean> {
    const gates = await this.prisma.gate.findMany({ where: { specId, gateType: { in: gateTypes } } });
    return gateTypes.every((type) => gates.find((gate) => gate.gateType === type)?.status === 'approved');
  }
}
