import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertValidTransition } from './state-machine';
import type { ProjectSourceType, ProjectStatus } from './types';

export interface CreateProjectInput {
  /** Nombre final de carpeta en la Plataforma (apps/api|web/src/modules/<slug>). */
  moduleSlug: string;
  displayName: string;
  requestedBy: string;
  /** Ruta o descripción del material fuente (carpeta del prototipo, texto libre). */
  sourceRef: string;
  sourceType?: ProjectSourceType;
}

/**
 * CRUD + transición de estado de proyectos. `transition` es el ÚNICO camino
 * para cambiar `status` — cualquier otro servicio del pipeline lo usa en vez
 * de un `prisma.project.update` directo, para que la máquina de estados
 * (state-machine.ts) sea imposible de saltarse por accidente.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateProjectInput) {
    return this.prisma.project.create({
      data: {
        moduleSlug: input.moduleSlug,
        displayName: input.displayName,
        requestedBy: input.requestedBy,
        sourceRef: input.sourceRef,
        sourceType: input.sourceType ?? 'manual'
      }
    });
  }

  async findById(id: string) {
    return this.prisma.project.findUniqueOrThrow({ where: { id } });
  }

  /**
   * Todos los proyectos con sus specs+gates (para la lista del control
   * plane, D-030). Método aditivo: no cambia nada de lo que ya consumía el
   * CLI (D-029). Los volúmenes de la Fábrica son pequeños (decenas de
   * proyectos, no miles) — sin paginación hasta que haga falta.
   */
  async list() {
    return this.prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { specs: { orderBy: { version: 'desc' }, include: { gates: true } } }
    });
  }

  /** Proyecto + todas sus specs (con gates) + runs, más reciente primero — lo que necesita un `status` de CLI o, más adelante, el dashboard. */
  async getFullStatus(id: string) {
    return this.prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
        specs: { orderBy: { version: 'desc' }, include: { gates: true } },
        runs: { orderBy: { createdAt: 'desc' } }
      }
    });
  }

  async transition(id: string, to: ProjectStatus) {
    const project = await this.findById(id);
    assertValidTransition(project.status as ProjectStatus, to);
    return this.prisma.project.update({ where: { id }, data: { status: to } });
  }
}
