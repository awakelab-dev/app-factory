import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertProjectVisibleToActor } from './actor-scope';
import { assertValidTransition } from './state-machine';
import type { FactoryActorContext, ProjectSourceType, ProjectStatus } from './types';

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
   * Con actor `gerente` (D-036) la lista se filtra a SUS proyectos
   * (`requestedBy` = email del PAT); sin actor o admin, todo.
   */
  async list(actor?: FactoryActorContext) {
    return this.prisma.project.findMany({
      where: actor?.role === 'gerente' ? { requestedBy: actor.email } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: { specs: { orderBy: { version: 'desc' }, include: { gates: true } } }
    });
  }

  /**
   * Catálogo de módulos para antiduplicación (docs/04, list_modules → GET
   * /modules, D-036): deriva de Project — TODOS los actores lo ven completo
   * (su función es precisamente que un gerente detecte que su idea ya existe,
   * aunque el proyecto sea de otro). Solo expone slug/estado/resumen, no la
   * spec entera ni la fuente.
   */
  async listModules() {
    return this.prisma.project.findMany({
      orderBy: { moduleSlug: 'asc' },
      include: { specs: { orderBy: { version: 'desc' }, take: 1 } }
    });
  }

  /** Proyecto + todas sus specs (con gates) + runs, más reciente primero — lo que necesita un `status` de CLI o, más adelante, el dashboard. Con actor `gerente`, solo si es SUYO (D-036). */
  async getFullStatus(id: string, actor?: FactoryActorContext) {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
        specs: { orderBy: { version: 'desc' }, include: { gates: true } },
        runs: { orderBy: { createdAt: 'desc' } }
      }
    });
    assertProjectVisibleToActor(project, actor);
    return project;
  }

  async transition(id: string, to: ProjectStatus) {
    const project = await this.findById(id);
    assertValidTransition(project.status as ProjectStatus, to);
    return this.prisma.project.update({ where: { id }, data: { status: to } });
  }
}
