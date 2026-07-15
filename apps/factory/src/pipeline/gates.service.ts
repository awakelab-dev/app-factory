import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';
import type { GateDecision, GateType } from './types';

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

    const updated = await this.prisma.gate.update({
      where: { id: input.gateId },
      data: {
        status: input.decision,
        reviewer: input.reviewer,
        decisionNotes: input.notes,
        decidedAt: new Date()
      }
    });

    const projectId = gate.spec.project.id;

    if (input.decision === 'rejected') {
      await this.projects.transition(projectId, 'rejected');
    } else if (input.decision === 'changes_requested') {
      await this.projects.transition(projectId, 'spec_ready');
    } else if (gate.gateType === 'pr_review') {
      await this.projects.transition(projectId, 'staging');
    } else if (gate.gateType === 'manager_acceptance') {
      await this.projects.transition(projectId, 'deployed');
    }
    // gateType functional/technical + approved: sin transición automática,
    // ver comentario de clase arriba.

    return updated;
  }

  /** `true` solo si TODOS los gateTypes pedidos existen para la spec y están `approved`. */
  async areSpecGatesApproved(specId: string, gateTypes: GateType[]): Promise<boolean> {
    const gates = await this.prisma.gate.findMany({ where: { specId, gateType: { in: gateTypes } } });
    return gateTypes.every((type) => gates.find((gate) => gate.gateType === type)?.status === 'approved');
  }
}
