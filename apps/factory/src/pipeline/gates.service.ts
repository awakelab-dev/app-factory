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

export interface GateAmendInput {
  gateId: string;
  reviewer: string;
  notes: string;
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
    // Los gates de REVISIÓN (pr_review/manager_acceptance) actúan sobre código
    // ya generado: "complementar" ahí significa REGENERAR (→ changes_requested
    // → generating), no re-analizar la spec. Los gates de spec
    // (functional/technical) actúan antes de generar: "complementar" vuelve a
    // `spec_ready` para re-analizar. (Bug corregido 2026-07-19: `decide`
    // mandaba TODO changes_requested a spec_ready, inservible para pr_review.)
    const isReviewGate = gate.gateType === 'pr_review' || gate.gateType === 'manager_acceptance';
    // gateType functional/technical + approved: sin transición automática
    // (target undefined), ver comentario de clase arriba.
    const target: ProjectStatus | undefined =
      input.decision === 'rejected'
        ? 'rejected'
        : input.decision === 'changes_requested'
          ? isReviewGate
            ? 'changes_requested'
            : 'spec_ready'
          : gate.gateType === 'pr_review'
            ? 'staging'
            : gate.gateType === 'manager_acceptance'
              ? // Aceptar al gerente deja el proyecto EN `manager_acceptance`
                // (estado de reposo: aceptado en staging, esperando promoción a
                // producción). `deployed` NO se alcanza aquí — llega solo con la
                // promoción manual (`advance <id> deployed` desde
                // manager_acceptance, ver STATUS "Siguiente"). Bug corregido
                // 2026-07-20: fijaba `deployed`, pero desde `staging` esa
                // transición no existe → InvalidTransitionError → HTTP 500 (era
                // lo que dejaba el gate manager_acceptance sin poder aprobarse).
                'manager_acceptance'
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

    // Aprobar el PR abre el gate de aceptación del gerente sobre la MISMA spec
    // (gate de primera clase, 2026-07-19): el gerente valida en staging y lo
    // decide en /factory, en vez de un `advance` manual sin fila auditable.
    if (input.decision === 'approved' && gate.gateType === 'pr_review') {
      await this.openGatesForSpec(gate.specId, ['manager_acceptance']);
    }

    return updated;
  }

  /**
   * Enmienda las notas de un gate YA decidido sin re-decidirlo (D-033,
   * 2026-07-19): reemplaza el UPDATE por SQL a mano que hubo que hacer en
   * `focus-flow` cuando una nota de gate resultó imprecisa tras la revisión de
   * PR. No cambia el `status` ni transiciona el proyecto — solo preserva la
   * nota original y añade la enmienda con su sello de auditoría, para que la
   * REgeneración (que lee las decisionNotes de los gates aprobados) reciba la
   * instrucción corregida.
   */
  async amendNotes(input: GateAmendInput) {
    const gate = await this.prisma.gate.findUniqueOrThrow({ where: { id: input.gateId } });
    if (gate.status === 'pending') {
      throw new BadRequestException(
        `El gate ${gate.id} sigue "pending" — decídelo con decide-gate, no lo enmiendes (la enmienda es para gates ya decididos).`
      );
    }
    const previous = gate.decisionNotes?.trim();
    const amended =
      (previous ? `${previous}\n\n` : '') +
      `[enmienda ${new Date().toISOString()} por ${input.reviewer}]\n${input.notes.trim()}`;
    return this.prisma.gate.update({
      where: { id: input.gateId },
      data: { decisionNotes: amended }
    });
  }

  /** `true` solo si TODOS los gateTypes pedidos existen para la spec y están `approved`. */
  async areSpecGatesApproved(specId: string, gateTypes: GateType[]): Promise<boolean> {
    const gates = await this.prisma.gate.findMany({ where: { specId, gateType: { in: gateTypes } } });
    return gateTypes.every((type) => gates.find((gate) => gate.gateType === type)?.status === 'approved');
  }
}
