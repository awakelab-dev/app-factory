import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { ChangeRequestsService } from './change-requests.service';

function buildService(overrides: { projectExists?: boolean } = {}) {
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
