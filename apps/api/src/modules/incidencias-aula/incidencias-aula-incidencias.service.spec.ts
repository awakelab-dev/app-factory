import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { AuditService } from '../../core/audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { IncidenciasService } from './incidencias-aula-incidencias.service';
import { IncidenciasPermissionsService } from './incidencias-aula-permissions.service';

const admin: AuthUser = { id: 'u-admin', email: 'a@awakelab.dev', displayName: 'Admin', roles: ['admin'] };
const coordinacion: AuthUser = {
  id: 'u-coord',
  email: 'coord@awakelab.dev',
  displayName: 'Coordinación',
  roles: ['incidencias_coordinacion']
};
const docente: AuthUser = {
  id: 'u-docente',
  email: 'docente@awakelab.dev',
  displayName: 'Docente',
  roles: ['incidencias_docente']
};
const otroDocente: AuthUser = {
  id: 'u-otro-docente',
  email: 'otro@awakelab.dev',
  displayName: 'Otro docente',
  roles: ['incidencias_docente']
};
const direccion: AuthUser = {
  id: 'u-direccion',
  email: 'direccion@awakelab.dev',
  displayName: 'Dirección',
  roles: ['incidencias_direccion']
};

const aulaRow = { id: 'aula-1', nombre: '1º DAM - A', activa: true, createdAt: new Date('2026-01-01') };

const baseIncidencia = {
  id: 'inc-1',
  alumnoNombre: 'Alumno de prueba',
  aulaId: 'aula-1',
  tipo: 'convivencia' as const,
  gravedad: 'media' as const,
  fechaHecho: new Date('2026-07-20'),
  relato: 'Relato de los hechos.',
  docenteId: 'u-docente',
  estado: 'abierta' as const,
  resolucion: null,
  cerradaAt: null,
  cerradaPorId: null,
  createdAt: new Date('2026-07-20T10:00:00.000Z'),
  updatedAt: new Date('2026-07-20T10:00:00.000Z'),
  seguimientos: [] as Array<{ id: string; incidenciaId: string; autorId: string; texto: string; createdAt: Date }>
};

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    aula: {
      findUnique: vi.fn().mockResolvedValue(aulaRow),
      findMany: vi.fn().mockResolvedValue([aulaRow])
    },
    incidencia: {
      findUnique: vi.fn().mockResolvedValue(baseIncidencia),
      findMany: vi.fn().mockResolvedValue([baseIncidencia]),
      create: vi.fn().mockResolvedValue(baseIncidencia),
      update: vi.fn().mockResolvedValue(baseIncidencia)
    },
    incidenciaSeguimiento: {
      create: vi.fn().mockResolvedValue({ id: 'seg-1', incidenciaId: 'inc-1', autorId: 'u-coord', texto: 'x', createdAt: new Date() })
    },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides
  } as unknown as PrismaService;

  const audit = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const permissions = new IncidenciasPermissionsService();
  return { service: new IncidenciasService(prisma, audit, permissions), prisma, audit };
}

describe('IncidenciasService.create', () => {
  it('crea la incidencia con docenteId = quien la registra y audita', async () => {
    const { service, prisma, audit } = buildService();
    const row = await service.create(docente, {
      alumnoNombre: 'Alumno',
      aulaId: 'aula-1',
      tipo: 'convivencia',
      gravedad: 'media',
      fechaHecho: '2026-07-20',
      relato: 'Relato'
    });
    expect(prisma.incidencia.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ docenteId: docente.id }) })
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'incidencias_aula.incidencia_creada' }));
    expect(row.aulaNombre).toBe('1º DAM - A');
  });

  it('lanza NotFound si el aula no existe', async () => {
    const { service } = buildService({ aula: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(
      service.create(docente, {
        alumnoNombre: 'Alumno',
        aulaId: 'aula-x',
        tipo: 'convivencia',
        gravedad: 'media',
        fechaHecho: '2026-07-20',
        relato: 'Relato'
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('IncidenciasService.detail (gate técnico, test exigido (a))', () => {
  it('un docente ve el detalle de SU PROPIA incidencia', async () => {
    const { service } = buildService();
    const detail = await service.detail(docente, 'inc-1');
    expect(detail.id).toBe('inc-1');
    expect(detail.alumnoNombre).toBe('Alumno de prueba');
  });

  it('403 cuando un docente pide el detalle de una incidencia de OTRO docente', async () => {
    const { service } = buildService();
    await expect(service.detail(otroDocente, 'inc-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('coordinación y admin ven el detalle de cualquier incidencia, y se audita el acceso', async () => {
    const { service, audit } = buildService();
    await service.detail(coordinacion, 'inc-1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'incidencias_aula.detalle_visto' }));

    audit.log = vi.fn().mockResolvedValue(undefined);
    const { service: adminService, audit: adminAudit } = buildService();
    await adminService.detail(admin, 'inc-1');
    expect(adminAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'incidencias_aula.detalle_visto' }));
  });

  it('el docente dueño NO dispara auditoría (solo coordinación/admin)', async () => {
    const { service, audit } = buildService();
    await service.detail(docente, 'inc-1');
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('lanza NotFound si la incidencia no existe', async () => {
    const { service } = buildService({ incidencia: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(service.detail(coordinacion, 'inc-x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('IncidenciasService.bandeja', () => {
  it('403 si quien pide la bandeja no es coordinación ni admin', async () => {
    const { service } = buildService();
    await expect(service.bandeja(docente, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.bandeja(direccion, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('coordinación ve la bandeja completa con los filtros aplicados', async () => {
    const { service, prisma } = buildService();
    await service.bandeja(coordinacion, { estado: 'abierta', aulaId: 'aula-1' });
    expect(prisma.incidencia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { estado: 'abierta', aulaId: 'aula-1' } })
    );
  });
});

describe('IncidenciasService.tomar', () => {
  it('403 si quien intenta tomar el caso no es coordinación ni admin', async () => {
    const { service } = buildService();
    await expect(service.tomar(docente, 'inc-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('pasa de "abierta" a "en_curso" y deja la entrada automática de seguimiento', async () => {
    const { service, prisma } = buildService();
    await service.tomar(coordinacion, 'inc-1');
    expect(prisma.incidencia.update).toHaveBeenCalledWith({ where: { id: 'inc-1' }, data: { estado: 'en_curso' } });
    expect(prisma.incidenciaSeguimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ texto: 'Caso tomado por coordinación' }) })
    );
  });

  it('rechaza tomar una incidencia que no está "abierta"', async () => {
    const { service } = buildService({
      incidencia: { findUnique: vi.fn().mockResolvedValue({ ...baseIncidencia, estado: 'en_curso' }) }
    });
    await expect(service.tomar(coordinacion, 'inc-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('IncidenciasService.addSeguimiento (gate técnico, test exigido (f))', () => {
  it('rechaza seguimiento sobre una incidencia CERRADA', async () => {
    const { service } = buildService({
      incidencia: { findUnique: vi.fn().mockResolvedValue({ ...baseIncidencia, estado: 'cerrada' }) }
    });
    await expect(service.addSeguimiento(coordinacion, 'inc-1', { texto: 'x' })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('403 si quien añade seguimiento no es coordinación ni admin', async () => {
    const { service } = buildService();
    await expect(service.addSeguimiento(docente, 'inc-1', { texto: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('si la incidencia estaba "abierta", pasa a "en_curso" al añadir seguimiento', async () => {
    const { service, prisma } = buildService();
    await service.addSeguimiento(coordinacion, 'inc-1', { texto: 'Hablé con la familia' });
    expect(prisma.incidencia.update).toHaveBeenCalledWith({ where: { id: 'inc-1' }, data: { estado: 'en_curso' } });
  });

  it('si ya estaba "en_curso", no vuelve a tocar el estado', async () => {
    const { service, prisma } = buildService({
      incidencia: {
        findUnique: vi.fn().mockResolvedValue({ ...baseIncidencia, estado: 'en_curso' }),
        update: vi.fn().mockResolvedValue(baseIncidencia)
      }
    });
    await service.addSeguimiento(coordinacion, 'inc-1', { texto: 'Seguimiento' });
    expect(prisma.incidencia.update).not.toHaveBeenCalled();
  });
});

describe('IncidenciasService.cerrar (gate técnico, test exigido (c))', () => {
  it('rechaza el cierre sin resolución, aunque el pipe Zod del controller se saltara (defensa en profundidad)', async () => {
    const { service } = buildService();
    await expect(service.cerrar(coordinacion, 'inc-1', { resolucion: '' })).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(service.cerrar(coordinacion, 'inc-1', { resolucion: '   ' })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('403 si quien cierra no es coordinación ni admin', async () => {
    const { service } = buildService();
    await expect(service.cerrar(docente, 'inc-1', { resolucion: 'Resuelto' })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('rechaza cerrar una incidencia ya cerrada', async () => {
    const { service } = buildService({
      incidencia: { findUnique: vi.fn().mockResolvedValue({ ...baseIncidencia, estado: 'cerrada' }) }
    });
    await expect(service.cerrar(coordinacion, 'inc-1', { resolucion: 'Resuelto' })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('cierra con resolución, registra cerradaAt/cerradaPorId y audita', async () => {
    const { service, prisma, audit } = buildService();
    await service.cerrar(coordinacion, 'inc-1', { resolucion: 'Se habló con la familia.' });
    expect(prisma.incidencia.update).toHaveBeenCalledWith({
      where: { id: 'inc-1' },
      data: expect.objectContaining({
        estado: 'cerrada',
        resolucion: 'Se habló con la familia.',
        cerradaPorId: coordinacion.id
      })
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'incidencias_aula.incidencia_cerrada' }));
  });
});
