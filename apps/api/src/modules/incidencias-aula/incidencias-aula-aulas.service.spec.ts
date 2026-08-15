import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { AuditService } from '../../core/audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { IncidenciasAulasService } from './incidencias-aula-aulas.service';
import { IncidenciasPermissionsService } from './incidencias-aula-permissions.service';

const admin: AuthUser = { id: 'u-admin', email: 'a@awakelab.dev', displayName: 'Admin', roles: ['admin'] };
const coordinacion: AuthUser = {
  id: 'u-coord',
  email: 'coord@awakelab.dev',
  displayName: 'Coordinación',
  roles: ['incidencias_coordinacion']
};

const aulaRow = { id: 'aula-1', nombre: '1º DAM - A', activa: true, createdAt: new Date('2026-01-01') };

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    aula: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([aulaRow]),
      create: vi.fn().mockResolvedValue(aulaRow),
      update: vi.fn().mockResolvedValue({ ...aulaRow, activa: false }),
      ...((overrides.aula as Record<string, unknown>) ?? {})
    }
  } as unknown as PrismaService;

  const audit = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const permissions = new IncidenciasPermissionsService();
  return { service: new IncidenciasAulasService(prisma, audit, permissions), prisma, audit };
}

describe('IncidenciasAulasService.listForUser', () => {
  it('sin "todas", filtra por activa=true incluso para admin', async () => {
    const { service, prisma } = buildService();
    await service.listForUser(admin, false);
    expect(prisma.aula.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { activa: true } }));
  });

  it('con "todas=true" y admin, no filtra por activa', async () => {
    const { service, prisma } = buildService();
    await service.listForUser(admin, true);
    expect(prisma.aula.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
  });

  it('con "todas=true" pero sin ser admin, igual filtra solo activas (no confía en el query param)', async () => {
    const { service, prisma } = buildService();
    await service.listForUser(coordinacion, true);
    expect(prisma.aula.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { activa: true } }));
  });
});

describe('IncidenciasAulasService.create', () => {
  it('crea el aula y audita', async () => {
    const { service, prisma, audit } = buildService();
    const result = await service.create(admin, { nombre: '1º DAM - A' });
    expect(prisma.aula.create).toHaveBeenCalledWith({ data: { nombre: '1º DAM - A' } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'incidencias_aula.aula_created' }));
    expect(result.nombre).toBe('1º DAM - A');
  });

  it('rechaza un nombre duplicado', async () => {
    const { service } = buildService({ aula: { findUnique: vi.fn().mockResolvedValue(aulaRow) } });
    await expect(service.create(admin, { nombre: '1º DAM - A' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('IncidenciasAulasService.update (desactivar)', () => {
  it('lanza NotFound si el aula no existe', async () => {
    const { service } = buildService();
    await expect(service.update(admin, 'aula-x', { activa: false })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('desactiva SIN borrar la fila (update, nunca delete)', async () => {
    const { service, prisma, audit } = buildService({
      aula: { findUnique: vi.fn().mockResolvedValue(aulaRow), update: vi.fn().mockResolvedValue({ ...aulaRow, activa: false }) }
    });
    const result = await service.update(admin, 'aula-1', { activa: false });
    expect(result.activa).toBe(false);
    expect(prisma.aula.update).toHaveBeenCalledWith({
      where: { id: 'aula-1' },
      data: { nombre: undefined, activa: false }
    });
    expect((prisma.aula as unknown as { delete?: unknown }).delete).toBeUndefined();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'incidencias_aula.aula_updated' }));
  });

  it('rechaza renombrar a un nombre ya usado por otra aula', async () => {
    const { service } = buildService({
      aula: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(aulaRow) // exists
          .mockResolvedValueOnce({ ...aulaRow, id: 'aula-2', nombre: '2º DAW' }) // clash
      }
    });
    await expect(service.update(admin, 'aula-1', { nombre: '2º DAW' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
