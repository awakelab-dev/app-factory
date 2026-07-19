import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { AuditService } from '../../core/audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { GestorPermissionsService } from './gestor-proyectos-permissions.service';
import { GestorProjectsService } from './gestor-proyectos-projects.service';
import { workDaysBetween } from './gestor-proyectos-workdays';

const admin: AuthUser = { id: 'u-admin', email: 'a@awakelab.dev', displayName: 'Admin', roles: ['admin'] };
const user: AuthUser = { id: 'u-1', email: 'b@awakelab.dev', displayName: 'Ejecutor', roles: ['user'] };

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    project: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn()
    },
    sprint: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn()
    },
    task: {
      groupBy: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    ...prismaOverrides
  } as unknown as PrismaService;

  const audit = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const permissions = new GestorPermissionsService(prisma);
  return { service: new GestorProjectsService(prisma, audit, permissions), prisma, audit };
}

describe('GestorProjectsService.listForUser', () => {
  it('admin: lista todos los proyectos, sin filtrar por tareas', async () => {
    const { service, prisma } = buildService({
      project: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p-1', name: 'Proyecto 1', description: null, createdAt: new Date('2026-07-01') }
        ])
      },
      task: {
        groupBy: vi.fn().mockResolvedValue([
          { projectId: 'p-1', status: 'iniciada', _count: { _all: 2 } },
          { projectId: 'p-1', status: 'finalizada', _count: { _all: 3 } }
        ])
      }
    });

    const result = await service.listForUser(admin);

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
    expect(result).toEqual([
      expect.objectContaining({ id: 'p-1', tasksCount: 5, openTasksCount: 2 })
    ]);
  });

  it('no-admin: filtra proyectos donde tiene alguna tarea asignada', async () => {
    const { service, prisma } = buildService();
    await service.listForUser(user);
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tasks: { some: { assigneeId: 'u-1' } } } })
    );
  });

  it('sin proyectos, no consulta contadores', async () => {
    const { service, prisma } = buildService();
    const result = await service.listForUser(user);
    expect(result).toEqual([]);
    expect(prisma.task.groupBy).not.toHaveBeenCalled();
  });
});

describe('GestorProjectsService.createProject', () => {
  it('crea el proyecto con Sprint 1 de 10 días hábiles arrancando en lunes', async () => {
    const { service, prisma, audit } = buildService({
      project: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'p-new',
            name: data.name,
            description: data.description,
            createdAt: new Date('2026-07-18T00:00:00.000Z'),
            updatedAt: new Date('2026-07-18T00:00:00.000Z'),
            createdById: data.createdById,
            sprints: [{ id: 's-1', projectId: 'p-new', ...data.sprints.create, createdAt: new Date() }]
          })
        )
      }
    });

    const result = await service.createProject(admin, { name: 'Proyecto Nuevo' });

    expect(result.name).toBe('Proyecto Nuevo');
    expect(result.sprints).toHaveLength(1);
    expect(result.sprints[0]!.name).toBe('Sprint 1');

    const createCall = vi.mocked(prisma.project.create).mock.calls[0]![0] as {
      data: { sprints: { create: { startDate: Date; endDate: Date } } };
    };
    const { startDate, endDate } = createCall.data.sprints.create;
    expect(startDate.getUTCDay()).toBe(1); // lunes
    expect(workDaysBetween(startDate, endDate)).toBe(10);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'gestor_proyectos.project_created', entityId: 'p-new' })
    );
  });
});

describe('GestorProjectsService.deleteProject', () => {
  it('lanza NotFound si el proyecto no existe', async () => {
    const { service, prisma } = buildService({
      project: { findUnique: vi.fn().mockResolvedValue(null), delete: vi.fn() }
    });
    await expect(service.deleteProject(admin, 'p-x')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.delete).not.toHaveBeenCalled();
  });

  it('elimina y audita', async () => {
    const { service, prisma, audit } = buildService({
      project: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p-1', name: 'Proyecto 1' }),
        delete: vi.fn().mockResolvedValue(undefined)
      }
    });
    await service.deleteProject(admin, 'p-1');
    expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'gestor_proyectos.project_deleted', entityId: 'p-1' })
    );
  });
});

describe('GestorProjectsService.getDetail', () => {
  const projectRow = {
    id: 'p-1',
    name: 'Proyecto 1',
    description: null,
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    createdById: 'u-admin',
    sprints: []
  };

  it('lanza NotFound si el proyecto no existe', async () => {
    const { service } = buildService({ project: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(service.getDetail(user, 'p-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza Forbidden si el usuario no participa', async () => {
    const { service } = buildService({
      project: { findUnique: vi.fn().mockResolvedValue(projectRow) },
      task: { findFirst: vi.fn().mockResolvedValue(null), groupBy: vi.fn().mockResolvedValue([]) }
    });
    await expect(service.getDetail(user, 'p-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el admin siempre puede ver el detalle', async () => {
    const { service } = buildService({ project: { findUnique: vi.fn().mockResolvedValue(projectRow) } });
    const detail = await service.getDetail(admin, 'p-1');
    expect(detail.id).toBe('p-1');
  });
});

describe('GestorProjectsService.createNextSprint', () => {
  it('lanza NotFound si el proyecto no existe', async () => {
    const { service } = buildService({ project: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(service.createNextSprint(admin, 'p-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza BadRequest si el proyecto no tiene sprint previo', async () => {
    const { service } = buildService({
      project: { findUnique: vi.fn().mockResolvedValue({ id: 'p-1' }) },
      sprint: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn(), create: vi.fn() }
    });
    await expect(service.createNextSprint(admin, 'p-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('arranca el lunes siguiente al fin del último sprint, numerado consecutivamente', async () => {
    const lastSprint = { id: 's-1', projectId: 'p-1', endDate: new Date('2026-07-31T00:00:00.000Z') }; // viernes
    const { service, prisma, audit } = buildService({
      project: { findUnique: vi.fn().mockResolvedValue({ id: 'p-1' }) },
      sprint: {
        findFirst: vi.fn().mockResolvedValue(lastSprint),
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 's-2', createdAt: new Date(), ...data }))
      }
    });

    const sprint = await service.createNextSprint(admin, 'p-1');

    expect(sprint.name).toBe('Sprint 2');
    const createCall = vi.mocked(prisma.sprint.create).mock.calls[0]![0] as {
      data: { startDate: Date; endDate: Date };
    };
    expect(createCall.data.startDate.toISOString().slice(0, 10)).toBe('2026-08-03'); // lunes tras el 31-jul
    expect(workDaysBetween(createCall.data.startDate, createCall.data.endDate)).toBe(10);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'gestor_proyectos.sprint_created' })
    );
  });
});
