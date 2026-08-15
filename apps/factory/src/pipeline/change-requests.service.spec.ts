import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { AnalysisJobsService } from './analysis-jobs.service';
import { ChangeRequestsService } from './change-requests.service';

function buildService(overrides: { projectExists?: boolean; alreadyQueued?: boolean } = {}) {
  const prisma = {
    project: {
      findUniqueOrThrow: vi.fn().mockImplementation(() =>
        overrides.projectExists === false
          ? Promise.reject(new Error('No project found'))
          : Promise.resolve({ id: 'proj-1', moduleSlug: 'gestor-proyectos', requestedBy: 'leonardo.barreto@awakelab.dev' })
      )
    },
    changeRequest: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'cr-1', ...data })
      )
    }
  } as unknown as PrismaService;

  const jobs = {
    enqueue: vi
      .fn()
      .mockResolvedValue({ job: { id: 'job-1', status: 'queued' }, alreadyQueued: overrides.alreadyQueued ?? false })
  } as unknown as AnalysisJobsService;

  return { service: new ChangeRequestsService(prisma, jobs), prisma, jobs };
}

describe('ChangeRequestsService.create', () => {
  it('crea la petición colgando del proyecto existente', async () => {
    const { service, prisma } = buildService();

    const cr = await service.create({
      projectId: 'proj-1',
      requestedBy: 'leonardo.barreto@awakelab.dev',
      requestText: 'Restringir a admin.'
    });

    expect(prisma.project.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'proj-1' } });
    expect(prisma.changeRequest.create).toHaveBeenCalledWith({
      data: { projectId: 'proj-1', requestedBy: 'leonardo.barreto@awakelab.dev', requestText: 'Restringir a admin.' }
    });
    expect(cr).toMatchObject({ id: 'cr-1', projectId: 'proj-1' });
  });

  // D-047: bug 2 de D-046 cerrado de raíz — la tool solo registraba y el cambio
  // se quedaba muerto en la base porque ningún comando podía retomarlo.
  it('encola el análisis del cambio al registrarlo', async () => {
    const { service, jobs } = buildService();

    const cr = await service.create({
      projectId: 'proj-1',
      requestedBy: 'leonardo.barreto@awakelab.dev',
      requestText: 'Restringir a admin.'
    });

    expect(jobs.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'change_analysis', projectId: 'proj-1', changeRequestId: 'cr-1' })
    );
    expect(cr).toMatchObject({ analysisAlreadyQueued: false });
  });

  it('con una iteración ya en curso, REGISTRA la petición igual y avisa que no entra ahora', async () => {
    const { service, prisma } = buildService({ alreadyQueued: true });

    const cr = await service.create({
      projectId: 'proj-1',
      requestedBy: 'leonardo.barreto@awakelab.dev',
      requestText: 'Otro cambio mientras corre el anterior.'
    });

    // Lo que escribió el gerente nunca se pierde.
    expect(prisma.changeRequest.create).toHaveBeenCalled();
    expect(cr).toMatchObject({ analysisAlreadyQueued: true });
  });

  it('el CLI (enqueueAnalysis: false) no encola: analiza él mismo, síncrono', async () => {
    const { service, jobs } = buildService();

    await service.create({
      projectId: 'proj-1',
      requestedBy: 'leonardo.barreto@awakelab.dev',
      requestText: 'Cambio por CLI.',
      enqueueAnalysis: false
    });

    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('falla (sin crear la petición) si el proyecto no existe', async () => {
    const { service, prisma } = buildService({ projectExists: false });

    await expect(
      service.create({ projectId: 'nope', requestedBy: 'x@y.com', requestText: 'x' })
    ).rejects.toThrow();
    expect(prisma.changeRequest.create).not.toHaveBeenCalled();
  });
});

describe('ChangeRequestsService.create — scope por rol (D-036)', () => {
  it('403 si un gerente pide un cambio sobre un proyecto ajeno, sin crear la petición', async () => {
    const { service, prisma } = buildService();

    await expect(
      service.create({
        projectId: 'proj-1',
        requestedBy: 'gerente@awakelab.dev',
        requestText: 'Cambiar el reporte semanal.',
        actor: { email: 'gerente@awakelab.dev', role: 'gerente' }
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.changeRequest.create).not.toHaveBeenCalled();
  });

  it('un gerente sí pide cambios sobre SU proyecto', async () => {
    const { service, prisma } = buildService();

    await service.create({
      projectId: 'proj-1',
      requestedBy: 'leonardo.barreto@awakelab.dev',
      requestText: 'Cambiar el reporte semanal.',
      actor: { email: 'leonardo.barreto@awakelab.dev', role: 'gerente' }
    });

    expect(prisma.changeRequest.create).toHaveBeenCalled();
  });
});
