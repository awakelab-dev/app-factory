import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { PrismaService } from '../../prisma/prisma.service';
import { GestorPermissionsService } from './gestor-proyectos-permissions.service';
import { GestorReportsService } from './gestor-proyectos-reports.service';

const admin: AuthUser = { id: 'u-admin', email: 'a@awakelab.dev', displayName: 'Admin', roles: ['admin'] };
const assignee: AuthUser = { id: 'u-1', email: 'b@awakelab.dev', displayName: 'Ejecutor', roles: ['user'] };

const sprintRow = {
  id: 's-1',
  projectId: 'p-1',
  name: 'Sprint 1',
  startDate: new Date('2026-07-20T00:00:00.000Z'), // lunes
  endDate: new Date('2026-07-31T00:00:00.000Z'), // viernes semana 2
  createdAt: new Date('2026-07-20T00:00:00.000Z')
};

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    sprint: { findUnique: vi.fn().mockResolvedValue(sprintRow) },
    task: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue({ id: 't-1' }) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides
  } as unknown as PrismaService;

  const permissions = new GestorPermissionsService(prisma);
  return { service: new GestorReportsService(prisma, permissions), prisma };
}

describe('GestorReportsService.report', () => {
  it('exige projectId y sprintId', async () => {
    const { service } = buildService();
    await expect(service.report(admin, undefined, 's-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.report(admin, 'p-1', undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lanza NotFound si el sprint no existe o no pertenece al proyecto indicado', async () => {
    const { service } = buildService({ sprint: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(service.report(admin, 'p-1', 's-x')).rejects.toBeInstanceOf(NotFoundException);

    const { service: service2 } = buildService({
      sprint: { findUnique: vi.fn().mockResolvedValue({ ...sprintRow, projectId: 'otro-proyecto' }) }
    });
    await expect(service2.report(admin, 'p-1', 's-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza Forbidden si el usuario no participa en el proyecto', async () => {
    const { service } = buildService({ task: { findMany: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) } });
    await expect(service.report(assignee, 'p-1', 's-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('calcula KPIs, desglose por estado/persona y proyección', async () => {
    // Fechas relativas a "ahora" (no absolutas): el sprint fijo de arriba
    // (jul-2026) es solo para el cálculo de días hábiles, que no depende de
    // la fecha real de ejecución del test — "vencida"/"no vencida" sí, así
    // que esas se calculan contra Date.now() real.
    const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const tasks = [
      { status: 'finalizada', assigneeId: 'u-1', dueDate: yesterday },
      { status: 'en_progreso', assigneeId: 'u-1', dueDate: yesterday }, // vencida
      { status: 'iniciada', assigneeId: 'u-2', dueDate: farFuture }
    ];
    const { service } = buildService({
      task: { findMany: vi.fn().mockResolvedValue(tasks) },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'u-1', displayName: 'Ejecutor Uno' },
          { id: 'u-2', displayName: 'Ejecutor Dos' }
        ])
      }
    });

    const report = await service.report(admin, 'p-1', 's-1');

    expect(report.totalTasks).toBe(3);
    expect(report.finishedTasks).toBe(1);
    expect(report.overdueTasks).toBe(1); // solo la 'en_progreso' con dueDate ayer — la 'finalizada' no cuenta aunque también venza ayer

    const finalizadaCount = report.byStatus.find((s) => s.status === 'finalizada')?.count;
    expect(finalizadaCount).toBe(1);

    const personUno = report.byPerson.find((p) => p.userId === 'u-1');
    expect(personUno).toEqual({ userId: 'u-1', userName: 'Ejecutor Uno', total: 2, finished: 1, overdue: 1 });

    expect(report.projection.workDaysTotal).toBe(10);
    expect(report.sprint.id).toBe('s-1');
  });
});
