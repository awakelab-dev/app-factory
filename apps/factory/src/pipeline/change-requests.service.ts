import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertProjectVisibleToActor } from './actor-scope';
import type { FactoryActorContext } from './types';

export interface CreateChangeRequestInput {
  projectId: string;
  requestedBy: string;
  /** Texto libre de la observación/petición sobre un módulo ya vivo. */
  requestText: string;
  /** Actor autenticado (D-036): un gerente solo pide cambios sobre SUS proyectos. Sin actor (CLI), sin scope. */
  actor?: FactoryActorContext;
}

/**
 * Alta de una petición de cambio (request_change, docs/04). Entidad ligera
 * (2026-07-19): solo guarda el texto + quién lo pide y cuelga del Project
 * existente — no arranca ninguna máquina de estados propia. El análisis de
 * cambio (AnalysisRunnerService.runChangeAnalysis) es quien mueve el pipeline.
 */
@Injectable()
export class ChangeRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateChangeRequestInput) {
    // findUniqueOrThrow para un error claro si el projectId no existe, antes de
    // crear una petición huérfana.
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: input.projectId } });
    assertProjectVisibleToActor(project, input.actor);
    return this.prisma.changeRequest.create({
      data: {
        projectId: input.projectId,
        requestedBy: input.requestedBy,
        requestText: input.requestText
      }
    });
  }
}
