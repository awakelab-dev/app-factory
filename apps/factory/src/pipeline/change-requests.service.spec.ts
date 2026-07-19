import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { ChangeRequestsService } from './change-requests.service';

function buildService(overrides: { projectExists?: boolean } = {}) {
  const prisma = {
    project: {
      findUniqueOrThrow: vi.fn().mockImplementation(() =>
        overrides.projectExists === false
          ? Promise.reject(new Error('No project found'))
          : Promise.resolve({ id: 'proj-1', moduleSlug: 'gestor-proyectos' })
      )
    },
    changeRequest: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'cr-1', ...data })
      )
    }
  } as unknown as PrismaService;

  return { service: new ChangeRequestsService(prisma), prisma };
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

  it('falla (sin crear la petición) si el proyecto no existe', async () => {
    const { service, prisma } = buildService({ projectExists: false });

    await expect(
      service.create({ projectId: 'nope', requestedBy: 'x@y.com', requestText: 'x' })
    ).rejects.toThrow();
    expect(prisma.changeRequest.create).not.toHaveBeenCalled();
  });
});
