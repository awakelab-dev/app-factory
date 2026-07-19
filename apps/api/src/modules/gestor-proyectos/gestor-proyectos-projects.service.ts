import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GestorPermissionsService } from './gestor-proyectos-permissions.service';
import { addWorkDays, nextMonday } from './gestor-proyectos-workdays';
import { toProjectDetailDto, toProjectSummaryDto, toSprintDto } from './gestor-proyectos.mappers';
import type {
  CreateGestorProjectRequest,
  GestorProjectDetail,
  GestorSprint,
  ProyectosTaskStatus
} from './gestor-proyectos.types';

/** Duración fija de un sprint (spec funcional, pregunta 3): 10 días hábiles
 * (2 semanas L-V), igual que el prototipo — no configurable por proyecto en este MVP. */
export const GESTOR_SPRINT_WORKDAYS = 10;

/** Estados que ya no cuentan como "abierta" para KPIs/participación de proyecto
 * (también usado por GestorTasksService.dashboard, que comparte esta noción de "abierta"). */
export const CLOSED_STATUSES = new Set<ProyectosTaskStatus>(['finalizada', 'cancelada']);

/**
 * Alta/baja/detalle de proyectos y sprints. Escritura administrativa
 * (`@Roles('admin')` en el controller); la lectura de detalle/kanban exige
 * además `participatesIn` (regla de fila, ver GestorPermissionsService).
 */
@Injectable()
export class GestorProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: GestorPermissionsService
  ) {}

  /** Admin: todos los proyectos; no-admin: solo donde participa (≥1 tarea asignada). */
  async listForUser(user: AuthUser) {
    const isAdmin = this.permissions.isAdmin(user);
    const projects = await this.prisma.project.findMany({
      where: isAdmin ? undefined : { tasks: { some: { assigneeId: user.id } } },
      orderBy: { createdAt: 'desc' }
    });
    if (projects.length === 0) return [];

    const counts = await this.taskCountsByProject(projects.map((p) => p.id));
    return projects.map((project) =>
      toProjectSummaryDto({
        ...project,
        tasksCount: counts.get(project.id)?.total ?? 0,
        openTasksCount: counts.get(project.id)?.open ?? 0
      })
    );
  }

  async createProject(user: AuthUser, dto: CreateGestorProjectRequest): Promise<GestorProjectDetail> {
    const start = nextMonday(new Date());
    const end = addWorkDays(start, GESTOR_SPRINT_WORKDAYS);

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        createdById: user.id,
        sprints: { create: { name: 'Sprint 1', startDate: start, endDate: end } }
      },
      include: { sprints: true }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'gestor_proyectos.project_created',
      entity: 'proyectos.projects',
      entityId: project.id,
      metadata: { name: project.name }
    });

    return toProjectDetailDto({ ...project, tasksCount: 0, openTasksCount: 0 });
  }

  async deleteProject(user: AuthUser, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`No existe el proyecto "${projectId}"`);

    // Cascada de Prisma (onDelete: Cascade en sprints/tasks) se lleva
    // sprints, tareas, subtareas y comentarios en la misma transacción implícita.
    await this.prisma.project.delete({ where: { id: projectId } });

    await this.audit.log({
      actorId: user.id,
      action: 'gestor_proyectos.project_deleted',
      entity: 'proyectos.projects',
      entityId: projectId,
      metadata: { name: project.name }
    });
  }

  async getDetail(user: AuthUser, projectId: string): Promise<GestorProjectDetail> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { sprints: { orderBy: { startDate: 'asc' } } }
    });
    if (!project) throw new NotFoundException(`No existe el proyecto "${projectId}"`);

    if (!(await this.permissions.participatesIn(user, projectId))) {
      throw new ForbiddenException('No participas en este proyecto');
    }

    const counts = await this.taskCountsByProject([projectId]);
    return toProjectDetailDto({
      ...project,
      tasksCount: counts.get(projectId)?.total ?? 0,
      openTasksCount: counts.get(projectId)?.open ?? 0
    });
  }

  /** Siguiente sprint: mismo cálculo de 10 días hábiles, arrancando el
   * próximo lunes tras el fin del último sprint existente. */
  async createNextSprint(user: AuthUser, projectId: string): Promise<GestorSprint> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`No existe el proyecto "${projectId}"`);

    const lastSprint = await this.prisma.sprint.findFirst({
      where: { projectId },
      orderBy: { endDate: 'desc' }
    });
    if (!lastSprint) {
      throw new BadRequestException('El proyecto no tiene un sprint previo (debería tener al menos Sprint 1)');
    }

    const dayAfterLast = new Date(lastSprint.endDate.getTime() + 24 * 60 * 60 * 1000);
    const start = nextMonday(dayAfterLast);
    const end = addWorkDays(start, GESTOR_SPRINT_WORKDAYS);

    const sprintCount = await this.prisma.sprint.count({ where: { projectId } });
    const sprint = await this.prisma.sprint.create({
      data: { projectId, name: `Sprint ${sprintCount + 1}`, startDate: start, endDate: end }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'gestor_proyectos.sprint_created',
      entity: 'proyectos.sprints',
      entityId: sprint.id,
      metadata: { projectId, name: sprint.name }
    });

    return toSprintDto(sprint);
  }

  private async taskCountsByProject(
    projectIds: string[]
  ): Promise<Map<string, { total: number; open: number }>> {
    const groups = await this.prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: { projectId: { in: projectIds } },
      _count: { _all: true }
    });

    const counts = new Map<string, { total: number; open: number }>();
    for (const group of groups) {
      const entry = counts.get(group.projectId) ?? { total: 0, open: 0 };
      entry.total += group._count._all;
      if (!CLOSED_STATUSES.has(group.status)) entry.open += group._count._all;
      counts.set(group.projectId, entry);
    }
    return counts;
  }
}
