import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrototypeManifest } from '@awk/types';
import type { PrismaService } from '../prisma/prisma.service';
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

  return { service: new SubmissionsService(prisma), prisma, txProject, txSubmission };
}

describe('SubmissionsService.create', () => {
  const input = {
    moduleSlug: 'gestor-vacaciones',
    displayName: 'Gestor de vacaciones',
    sourceHtml: '<html>proto</html>',
    manifest,
    submittedBy: 'gerente@awakelab.dev'
  };

  it('crea Project cowork_prototype + submission en transacción, SIN disparar análisis (queda received)', async () => {
    const { service, txProject, txSubmission } = buildService();

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
    expect(result.project.status).toBe('received');
    expect(result.submission.id).toBe('sub-1');
  });

  it('409 si el slug ya existe (sugiere request_change o list_modules), sin crear nada', async () => {
    const { service, txProject } = buildService({ slugTaken: true });

    await expect(service.create(input)).rejects.toBeInstanceOf(ConflictException);
    expect(txProject.create).not.toHaveBeenCalled();
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
