import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';
import { InvalidTransitionError } from './state-machine';

function buildService(overrides: { status?: string; requestedBy?: string } = {}) {
  const project = {
    id: 'proj-1',
    status: overrides.status ?? 'received',
    moduleSlug: 'demo',
    requestedBy: overrides.requestedBy ?? 'leonardo.barreto@awakelab.dev'
  };

  const prisma = {
    project: {
      create: vi.fn().mockResolvedValue(project),
      findUniqueOrThrow: vi.fn().mockResolvedValue(project),
      findMany: vi.fn().mockResolvedValue([project]),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...project, ...data }))
    }
  } as unknown as PrismaService;

  return { service: new ProjectsService(prisma), prisma, project };
}

describe('ProjectsService', () => {
  it('create() pasa sourceType por defecto "manual"', async () => {
    const { service, prisma } = buildService();

    await service.create({
      moduleSlug: 'demo',
      displayName: 'Demo',
      requestedBy: 'leonardo@awakelab.dev',
      sourceRef: '/tmp/demo'
    });

    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sourceType: 'manual' }) })
    );
  });

  it('transition() aplica una transición válida', async () => {
    const { service, prisma } = buildService({ status: 'received' });

    const updated = await service.transition('proj-1', 'analyzing');

    expect(updated.status).toBe('analyzing');
    expect(prisma.project.update).toHaveBeenCalledWith({ where: { id: 'proj-1' }, data: { status: 'analyzing' } });
  });

  it('transition() rechaza una transición inválida sin llamar a update', async () => {
    const { service, prisma } = buildService({ status: 'received' });

    await expect(service.transition('proj-1', 'deployed')).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});

describe('ProjectsService — scope por rol (D-036)', () => {
  const gerente = { email: 'gerente@awakelab.dev', role: 'gerente' as const };

  it('list() con actor gerente filtra por requestedBy = su email', async () => {
    const { service, prisma } = buildService();

    await service.list(gerente);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requestedBy: gerente.email } })
    );
  });

  it('list() sin actor (CLI) o con admin no filtra', async () => {
    const { service, prisma } = buildService();

    await service.list();
    await service.list({ email: 'leonardo.barreto@awakelab.dev', role: 'admin' });

    for (const call of (prisma.project.findMany as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[0].where).toBeUndefined();
    }
  });

  it('getFullStatus() lanza 403 si un gerente consulta un proyecto ajeno', async () => {
    const { service } = buildService({ requestedBy: 'otro@awakelab.dev' });

    await expect(service.getFullStatus('proj-1', gerente)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getFullStatus() devuelve el proyecto propio de un gerente', async () => {
    const { service } = buildService({ requestedBy: gerente.email });

    await expect(service.getFullStatus('proj-1', gerente)).resolves.toMatchObject({ id: 'proj-1' });
  });

  it('listModules() devuelve el catálogo completo sin filtrar por actor (antiduplicación)', async () => {
    const { service, prisma } = buildService();

    await service.listModules();

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ where: expect.anything() }));
  });
});
