import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertProjectVisibleToActor } from './actor-scope';
import { AnalysisJobsService } from './analysis-jobs.service';
import type { AnalysisJobRow, FactoryActorContext } from './types';

export interface CreateChangeRequestInput {
  projectId: string;
  requestedBy: string;
  /** Texto libre de la observación/petición sobre un módulo ya vivo. */
  requestText: string;
  /** Actor autenticado (D-036): un gerente solo pide cambios sobre SUS proyectos. Sin actor (CLI), sin scope. */
  actor?: FactoryActorContext;
  /**
   * Encolar el análisis del cambio al crearlo (D-047). true por defecto: es el
   * camino de Cowork. El CLI `request-change` lo pasa en false porque analiza
   * él mismo, de forma síncrona, en el mismo comando.
   */
  enqueueAnalysis?: boolean;
}

/**
 * Alta de una petición de cambio (request_change, docs/04). Entidad ligera
 * (2026-07-19): solo guarda el texto + quién lo pide y cuelga del Project
 * existente — no arranca ninguna máquina de estados propia. El análisis de
 * cambio (AnalysisRunnerService.runChangeAnalysis) es quien mueve el pipeline.
 *
 * Desde D-047 la creación **encola** ese análisis. Antes no: la tool del
 * conector solo registraba y ningún comando podía retomar una petición ya
 * creada, así que un cambio pedido desde el chat se quedaba muerto en la base
 * (bug 2 de D-046, parcheado entonces con el comando `analyze-change`, que se
 * conserva como escotilla manual).
 */
@Injectable()
export class ChangeRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: AnalysisJobsService
  ) {}

  async create(input: CreateChangeRequestInput) {
    // findUniqueOrThrow para un error claro si el projectId no existe, antes de
    // crear una petición huérfana.
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: input.projectId } });
    assertProjectVisibleToActor(project, input.actor);
    const changeRequest = await this.prisma.changeRequest.create({
      data: {
        projectId: input.projectId,
        requestedBy: input.requestedBy,
        requestText: input.requestText
      }
    });

    if (input.enqueueAnalysis === false) return changeRequest;

    // El encolado va DESPUÉS de crear la petición, no en su transacción, a
    // propósito: si ya hay un análisis en curso sobre ese módulo, lo que
    // escribió el gerente queda REGISTRADO igual y `alreadyQueued` informa —
    // que es lo que la tool traduce a "hay un análisis en curso; este cambio
    // entra después".
    const { job, alreadyQueued } = await this.jobs.enqueue({
      kind: 'change_analysis',
      projectId: input.projectId,
      changeRequestId: changeRequest.id,
      requestedBy: input.requestedBy
    });
    return Object.assign(changeRequest, {
      analysisJob: job as AnalysisJobRow,
      analysisAlreadyQueued: alreadyQueued
    });
  }
}
