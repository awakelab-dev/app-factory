import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { GestorPermissionsService } from './gestor-proyectos-permissions.service';
import { startOfDay, workDaysBetween, workDaysElapsed } from './gestor-proyectos-workdays';
import { resolveUserNames, toSprintDto } from './gestor-proyectos.mappers';
import { proyectosTaskStatusSchema, type GestorReport } from './gestor-proyectos.types';

const ALL_STATUSES = proyectosTaskStatusSchema.options;
const OPEN_OVERDUE_STATUSES = new Set(['finalizada', 'cancelada']);

/**
 * Reportes por proyecto+sprint (spec-tecnica.md): KPIs, proyección (real vs.
 * esperado por días hábiles transcurridos), desglose por estado y por
 * persona — todo calculado server-side reutilizando las mismas tareas que
 * el tablero, sin un endpoint aparte por métrica.
 */
@Injectable()
export class GestorReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: GestorPermissionsService
  ) {}

  async report(user: AuthUser, projectId: string | undefined, sprintId: string | undefined): Promise<GestorReport> {
    if (!projectId || !sprintId) {
      throw new BadRequestException('projectId y sprintId son obligatorios');
    }

    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint || sprint.projectId !== projectId) {
      throw new NotFoundException(`No existe el sprint "${sprintId}" en el proyecto "${projectId}"`);
    }

    if (!(await this.permissions.participatesIn(user, projectId))) {
      throw new ForbiddenException('No participas en este proyecto');
    }

    const tasks = await this.prisma.task.findMany({
      where: { sprintId },
      select: { status: true, assigneeId: true, dueDate: true }
    });

    const today = startOfDay(new Date());
    const isOverdue = (task: { status: string; dueDate: Date }) =>
      !OPEN_OVERDUE_STATUSES.has(task.status) && task.dueDate.getTime() < today.getTime();

    const totalTasks = tasks.length;
    const finishedTasks = tasks.filter((t) => t.status === 'finalizada').length;
    const overdueTasks = tasks.filter(isOverdue).length;

    const byStatusCounts = new Map<string, number>();
    for (const task of tasks) byStatusCounts.set(task.status, (byStatusCounts.get(task.status) ?? 0) + 1);
    const byStatus = ALL_STATUSES.map((status) => ({ status, count: byStatusCounts.get(status) ?? 0 }));

    const byPersonCounts = new Map<string, { total: number; finished: number; overdue: number }>();
    for (const task of tasks) {
      const entry = byPersonCounts.get(task.assigneeId) ?? { total: 0, finished: 0, overdue: 0 };
      entry.total += 1;
      if (task.status === 'finalizada') entry.finished += 1;
      if (isOverdue(task)) entry.overdue += 1;
      byPersonCounts.set(task.assigneeId, entry);
    }
    const names = await resolveUserNames(this.prisma, byPersonCounts.keys());
    const byPerson = [...byPersonCounts.entries()].map(([userId, counts]) => ({
      userId,
      userName: names.get(userId) ?? null,
      ...counts
    }));

    const workDaysTotal = workDaysBetween(sprint.startDate, sprint.endDate);
    const workDaysElapsedCount = workDaysElapsed(sprint.startDate, sprint.endDate, today);
    const expectedProgressPct =
      workDaysTotal === 0 ? 0 : Math.min(100, (workDaysElapsedCount / workDaysTotal) * 100);
    const actualProgressPct = totalTasks === 0 ? 0 : (finishedTasks / totalTasks) * 100;

    return {
      sprint: toSprintDto(sprint),
      totalTasks,
      finishedTasks,
      overdueTasks,
      byStatus,
      byPerson,
      projection: {
        workDaysTotal,
        workDaysElapsed: workDaysElapsedCount,
        expectedProgressPct,
        actualProgressPct
      }
    };
  }
}
