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

  it('coordinación ve la bandeja completa con los filtros aplicados (estado + aula)', async () => {
    const { service, prisma } = buildService();
    await service.bandeja(coordinacion, { estado: 'abierta', aulaId: 'aula-1' });
    expect(prisma.incidencia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { estado: 'abierta', aulaId: 'aula-1', gravedad: undefined } })
    );
  });

  it('filtra por gravedad sola', async () => {
    const { service, prisma } = buildService();
    await service.bandeja(coordinacion, { gravedad: 'alta' });
    expect(prisma.incidencia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { estado: undefined, aulaId: undefined, gravedad: 'alta' } })
    );
  });

  it('gate técnico test exigido (b): filtra por gravedad combinada con estado y aula a la vez', async () => {
    const { service, prisma } = buildService();
    await service.bandeja(coordinacion, { estado: 'en_curso', aulaId: 'aula-1', gravedad: 'alta' });
    expect(prisma.incidencia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { estado: 'en_curso', aulaId: 'aula-1', gravedad: 'alta' } })
    );
  });

  describe('diasAbierta (mini-spec técnica, cambio 2)', () => {
    const now = new Date('2026-07-20T00:00:00.000Z');

    it('para una incidencia ABIERTA, cuenta días naturales desde createdAt hasta "now" inyectado', async () => {
      const { service } = buildService({
        incidencia: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ ...baseIncidencia, id: 'inc-a', createdAt: new Date('2026-07-01T00:00:00.000Z') }])
        }
      });
      const rows = await service.bandeja(coordinacion, {}, now);
      expect(rows[0]?.diasAbierta).toBe(19);
    });

    it('gate técnico test exigido (a): para una incidencia CERRADA, se mide contra cerradaAt y NO avanza con el reloj', async () => {
      const cerrada = {
        ...baseIncidencia,
        id: 'inc-c',
        estado: 'cerrada' as const,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        cerradaAt: new Date('2026-06-05T00:00:00.000Z')
      };
      const { service } = buildService({ incidencia: { findMany: vi.fn().mockResolvedValue([cerrada]) } });

      const rowsNow = await service.bandeja(coordinacion, {}, now);
      expect(rowsNow[0]?.diasAbierta).toBe(4);

      // "now" mucho más tarde no cambia nada: el reloj de una cerrada ya se detuvo.
      const muchoMasTarde = new Date('2026-12-01T00:00:00.000Z');
      const rowsLater = await service.bandeja(coordinacion, {}, muchoMasTarde);
      expect(rowsLater[0]?.diasAbierta).toBe(4);
    });
  });

  describe('orden de la bandeja (mini-spec técnica, cambio 2)', () => {
    const abierta19 = { ...baseIncidencia, id: 'inc-a', estado: 'abierta' as const, createdAt: new Date('2026-07-01T00:00:00.000Z'), cerradaAt: null };
    const enCurso10 = { ...baseIncidencia, id: 'inc-b', estado: 'en_curso' as const, createdAt: new Date('2026-07-10T00:00:00.000Z'), cerradaAt: null };
    const cerrada4 = {
      ...baseIncidencia,
      id: 'inc-c',
      estado: 'cerrada' as const,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      cerradaAt: new Date('2026-06-05T00:00:00.000Z')
    };
    const now = new Date('2026-07-20T00:00:00.000Z');

    it('con estado undefined/abierta/en_curso, ordena por diasAbierta descendente', async () => {
      const { service } = buildService({
        // findMany ya viene ordenado por createdAt desc (orden de Prisma) —
        // el resultado debe quedar reordenado por diasAbierta, no por eso.
        incidencia: { findMany: vi.fn().mockResolvedValue([enCurso10, cerrada4, abierta19]) }
      });

      const sinFiltro = await service.bandeja(coordinacion, {}, now);
      expect(sinFiltro.map((r) => r.id)).toEqual(['inc-a', 'inc-b', 'inc-c']);

      const filtroAbierta = await service.bandeja(coordinacion, { estado: 'abierta' }, now);
      expect(filtroAbierta.map((r) => r.id)).toEqual(['inc-a', 'inc-b', 'inc-c']);

      const filtroEnCurso = await service.bandeja(coordinacion, { estado: 'en_curso' }, now);
      expect(filtroEnCurso.map((r) => r.id)).toEqual(['inc-a', 'inc-b', 'inc-c']);
    });

    it('con estado "cerrada", mantiene el orden de la consulta (createdAt desc) sin reordenar por diasAbierta', async () => {
      // Orden de llegada deliberadamente NO descendente por diasAbierta, para
      // detectar si el servicio reordenara por error.
      const { service } = buildService({
        incidencia: { findMany: vi.fn().mockResolvedValue([cerrada4, abierta19]) }
      });
      const rows = await service.bandeja(coordinacion, { estado: 'cerrada' }, now);
      expect(rows.map((r) => r.id)).toEqual(['inc-c', 'inc-a']);
    });
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
