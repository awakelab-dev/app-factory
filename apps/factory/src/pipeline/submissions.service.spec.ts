import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrototypeManifest } from '@awk/types';
import type { PrismaService } from '../prisma/prisma.service';
import type { AnalysisJobsService } from './analysis-jobs.service';
import { SubmissionsService } from './submissions.service';

const manifest: PrototypeManifest = {
  name: 'Gestor de vacaciones',
  purpose: 'Solicitar y aprobar vacaciones.',
  actors: [{ role: 'empleado' }],
  entities: [{ name: 'solicitud', sensitivity: 'interno' }],
  relatedProcesses: []
};

function buildService(overrides: { slugTaken?: boolean; submission?: Record<string, unknown> | null } = {}) {
  const txProject = {
    create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'proj-1', status: 'received', ...data })
    ),
    update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'proj-1', status: 'received', moduleSlug: 'gestor-vacaciones', ...data })
    )
  };
  const txSubmission = {
    create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'sub-1', createdAt: new Date(), ...data })
    )
  };
  const prisma = {
    project: {
      findUnique: vi
        .fn()
        .mockResolvedValue(overrides.slugTaken ? { id: 'proj-otro', moduleSlug: 'gestor-vacaciones', status: 'deployed' } : null)
    },
    prototypeSubmission: {
      findFirst: vi.fn().mockResolvedValue(overrides.submission ?? null)
    },
    $transaction: vi
      .fn()
      .mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({ project: txProject, prototypeSubmission: txSubmission }))
  } as unknown as PrismaService;

  const jobs = {
    enqueueIn: vi.fn().mockResolvedValue({ job: { id: 'job-1', status: 'queued' }, alreadyQueued: false })
  } as unknown as AnalysisJobsService;

  return { service: new SubmissionsService(prisma, jobs), prisma, txProject, txSubmission, jobs };
}

describe('SubmissionsService.create', () => {
  const input = {
    moduleSlug: 'gestor-vacaciones',
    displayName: 'Gestor de vacaciones',
    sourceHtml: '<html>proto</html>',
    manifest,
    submittedBy: 'gerente@awakelab.dev'
  };

  it('crea Project cowork_prototype + submission + trabajo de análisis en la MISMA transacción (D-047)', async () => {
    const { service, txProject, txSubmission, jobs } = buildService();

    const result = await service.create(input);

    expect(txProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        moduleSlug: 'gestor-vacaciones',
        sourceType: 'cowork_prototype',
        requestedBy: 'gerente@awakelab.dev'
      })
    });
    expect(txSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'proj-1', source: '<html>proto</html>', submittedBy: 'gerente@awakelab.dev' })
    });
    // sourceRef queda apuntando a la fila real de la submission.
    expect(txProject.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: { sourceRef: 'db://prototype_submissions/sub-1' }
    });
    // D-047: el análisis se ENCOLA aquí (no se ejecuta: eso es del worker), y
    // en la misma transacción — no puede quedar un prototipo recibido que
    // nadie vaya a analizar, que es lo que obligaba a llamar a Sistemas.
    expect(jobs.enqueueIn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'analysis', projectId: 'proj-1', requestedBy: 'gerente@awakelab.dev' })
    );
    // El proyecto sigue en `received` hasta que el worker lo tome: la máquina
    // de estados no cambia.
    expect(result.project.status).toBe('received');
    expect(result.submission.id).toBe('sub-1');
    expect(result.analysisJob.id).toBe('job-1');
  });

  it('409 si el slug ya existe (sugiere request_change o list_modules), sin crear nada ni encolar', async () => {
    const { service, txProject, jobs } = buildService({ slugTaken: true });

    await expect(service.create(input)).rejects.toBeInstanceOf(ConflictException);
    expect(txProject.create).not.toHaveBeenCalled();
    expect(jobs.enqueueIn).not.toHaveBeenCalled();
  });
});

describe('SubmissionsService.getLatestForProject', () => {
  it('devuelve la última submission del proyecto', async () => {
    const { service, prisma } = buildService({ submission: { id: 'sub-2', source: '<html/>', manifest } });

    const submission = await service.getLatestForProject('proj-1');

    expect(submission.id).toBe('sub-2');
    expect(prisma.prototypeSubmission.findFirst).toHaveBeenCalledWith({
      where: { projectId: 'proj-1' },
      orderBy: { createdAt: 'desc' }
    });
  });

  it('404 claro si un proyecto cowork_prototype no tiene submission', async () => {
    const { service } = buildService({ submission: null });

    await expect(service.getLatestForProject('proj-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
