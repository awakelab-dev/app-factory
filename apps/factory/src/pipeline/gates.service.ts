import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertProjectVisibleToActor } from './actor-scope';
import { AnalysisJobsService } from './analysis-jobs.service';
import { ProjectsService } from './projects.service';
import type { FactoryActorContext, GateDecision, GateType, ProjectStatus } from './types';

/** Gates que un `gerente` puede decidir (D-036): los de negocio. `technical`/`pr_review` son solo-admin. */
const MANAGER_GATE_TYPES: readonly GateType[] = ['functional', 'manager_acceptance'];

/** Gates de SPEC que hay que tener aprobados para poder generar (docs/05). */
const REQUIRED_SPEC_GATES: readonly GateType[] = ['functional', 'technical'];

export interface GateDecisionInput {
  gateId: string;
  decision: GateDecision;
  reviewer: string;
  notes?: string;
  /**
   * Actor autenticado (D-036). Sin actor (CLI) no se aplica el modelo de
   * roles — con actor `gerente`, solo gates functional/manager_acceptance
   * de SUS proyectos (requestedBy).
   */
  actor?: FactoryActorContext;
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
 * **Desde D3, decidir un gate ENCOLA trabajo** (docs/09). Es el fin de la
 * fricción de D-048 ("aprobé los dos gates y no pasa nada", con la generación
 * esperando a que Sistemas la lanzara desde una terminal):
 *
 *  - aprobar el gate que deja `functional` + `technical` en verde → encola
 *    `generation` para esa spec;
 *  - `changes_requested` en un gate de SPEC (`functional`/`technical`) → encola
 *    un RE-ANÁLISIS (2026-08-27): la máquina de estados ya preveía
 *    `spec_ready → analyzing` "para re-correr el análisis", pero nadie
 *    encolaba ese trabajo y el proyecto se quedaba en `spec_ready` para
 *    siempre — la misma fricción de D-048 que D3 cerró solo del lado de
 *    aprobar. Lo destapó `panel-prioridades`, el primer gate decidido por un
 *    gerente ajeno a Sistemas: pidió cambios y no volvió a pasar nada;
 *  - `changes_requested` en `pr_review` → encola una REGENERACIÓN;
 *  - aprobar `pr_review` → encola `pr_merge`, y **no** transiciona a `staging`:
 *    eso lo hace el worker cuando ha visto la PR mergeada de verdad (D-049,
 *    "los gates son declarativos").
 *
 * Se respeta D-030: el HTTP encola, otro proceso ejecuta. Aquí no corre ningún
 * agente ni ningún `git`.
 */
@Injectable()
export class GatesService {
  private readonly logger = new Logger(GatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly jobs: AnalysisJobsService
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

    // Modelo de roles (D-036): el scope va ANTES que cualquier escritura.
    if (input.actor?.role === 'gerente') {
      assertProjectVisibleToActor(gate.spec.project, input.actor);
      if (!MANAGER_GATE_TYPES.includes(gate.gateType as GateType)) {
        throw new ForbiddenException(
          `El gate ${gate.gateType} es de revisión técnica — solo lo decide un admin. Un gerente decide ${MANAGER_GATE_TYPES.join(' y ')}.`
        );
      }
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
            ? // D3: aprobar `pr_review` NO lleva el proyecto a `staging`. Encola
              // `pr_merge` y es el worker quien transiciona, DESPUÉS de haber
              // visto la PR mergeada. Mientras tanto el proyecto se queda aquí,
              // que es la verdad: hay código aprobado y todavía no está en main.
              undefined
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

    await this.enqueueFollowUpWork(gate.specId, projectId, gate.gateType as GateType, input);

    return updated;
  }

  /**
   * Trabajo que dispara una decisión de gate (D3). Se hace DESPUÉS de escribir
   * el gate: si encolar falla, la decisión ya está registrada y el trabajo se
   * repone con `cli enqueue-generation` — al revés dejaría un trabajo en la
   * cola para un gate que nadie decidió.
   *
   * Encolar es idempotente por diseño (`enqueueIn` devuelve el trabajo activo
   * que ya hubiera para el proyecto en vez de crear otro), así que dos
   * aprobaciones seguidas no producen dos generaciones.
   */
  private async enqueueFollowUpWork(
    specId: string,
    projectId: string,
    gateType: GateType,
    input: GateDecisionInput
  ): Promise<void> {
    // Aprobar el gate que completa functional+technical dispara la generación.
    // Antes de D3 el proyecto se quedaba en `pending_approval` esperando a que
    // alguien corriera `cli generate <specId>` (D-048).
    if (input.decision === 'approved' && (gateType === 'functional' || gateType === 'technical')) {
      if (await this.areSpecGatesApproved(specId, [...REQUIRED_SPEC_GATES])) {
        await this.enqueue('generation', specId, projectId, input.reviewer, 'gates de spec aprobados');
      }
      return;
    }

    // "Complementar" un gate de SPEC (docs/05) = re-analizar con las
    // correcciones del revisor, que viajan en las `decisionNotes` y las lee
    // `AnalysisRunnerService.runAnalysis`. Se encola aquí para que decidir el
    // gate sea lo único que haga falta (norte de cero consola, docs/09): antes
    // esto exigía `cli enqueue-analysis` por terminal, y como nada lo decía,
    // no se hacía. NO se pasa `specId`: el re-análisis crea la versión
    // SIGUIENTE de spec con gates frescos, no trabaja sobre la vigente.
    if (input.decision === 'changes_requested' && REQUIRED_SPEC_GATES.includes(gateType)) {
      await this.enqueue('analysis', specId, projectId, input.reviewer, `el gate ${gateType} pidió cambios`);
      return;
    }

    if (gateType !== 'pr_review') return;

    // Aprobar la PR: el merge lo hace el worker, que tiene `gh` y credencial.
    // El gate `manager_acceptance` NO se abre aquí — lo abre el merge, cuando
    // ya hay algo en staging que el gerente pueda validar.
    if (input.decision === 'approved') {
      await this.enqueue('pr_merge', specId, projectId, input.reviewer, 'PR aprobada');
      return;
    }

    // "Complementar" sobre la PR = regenerar sobre la misma rama con las notas
    // del revisor (que `GenerationRunnerService` lee de los gates aprobados).
    if (input.decision === 'changes_requested') {
      await this.enqueue('generation', specId, projectId, input.reviewer, 'la revisión de PR pidió cambios');
    }
  }

  private async enqueue(
    kind: 'analysis' | 'generation' | 'pr_merge',
    specId: string,
    projectId: string,
    requestedBy: string,
    motivo: string
  ): Promise<void> {
    const { job, alreadyQueued } = await this.jobs.enqueue({
      kind,
      projectId,
      // `specId` es del contrato de generación (D3). Un re-análisis no lo
      // lleva: produce una spec nueva, no consume la que se está corrigiendo.
      specId: kind === 'analysis' ? undefined : specId,
      requestedBy
    });
    this.logger.log(
      alreadyQueued
        ? `Ya había un trabajo activo para el proyecto ${projectId} (${job.kind} ${job.id}): no se encola ${kind}.`
        : `Encolado ${kind} para la spec ${specId} (${motivo}): trabajo ${job.id}.`
    );
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
