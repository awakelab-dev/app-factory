import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';
import { InvalidTransitionError } from './state-machine';

function buildService(overrides: { status?: string } = {}) {
  const project = { id: 'proj-1', status: overrides.status ?? 'received', moduleSlug: 'demo' };

  const prisma = {
    project: {
      create: vi.fn().mockResolvedValue(project),
      findUniqueOrThrow: vi.fn().mockResolvedValue(project),
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
