import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import { IncidenciasResumenService } from './incidencias-aula-resumen.service';

const aulaRow = { id: 'aula-1', nombre: '1º DAM - A' };

// Fila simulando un defecto upstream (p. ej. alguien ensancha el `select` del
// servicio): el mapper NUNCA debe copiar estos campos identificativos a la
// respuesta, aunque estén presentes en la fila que llega de Prisma (gate
// técnico, test exigido (b)).
const rowWithLeakedFields = {
  id: 'inc-1',
  aulaId: 'aula-1',
  tipo: 'convivencia' as const,
  gravedad: 'alta' as const,
  fechaHecho: new Date('2026-07-05'),
  estado: 'cerrada' as const,
  createdAt: new Date('2026-07-05T09:00:00.000Z'),
  cerradaAt: new Date('2026-07-08T09:00:00.000Z'),
  // Campos que NO deberían llegar aquí en una fila real (el `select` del
  // servicio no los pide) — presentes solo para probar que el mapper los
  // ignora aunque existieran.
  alumnoNombre: 'Nombre real de alumno',
  relato: 'Relato completo de los hechos',
  seguimientos: [{ id: 'seg-1', texto: 'seguimiento interno' }]
};

function buildService(rows: unknown[]) {
  const prisma = {
    incidencia: { findMany: vi.fn().mockResolvedValue(rows) },
    aula: { findMany: vi.fn().mockResolvedValue([aulaRow]) }
  } as unknown as PrismaService;
  return { service: new IncidenciasResumenService(prisma), prisma };
}

describe('IncidenciasResumenService.resumenMensual (gate técnico, test exigido (b))', () => {
  it('el `select` de Prisma no pide alumnoNombre, relato ni seguimientos', async () => {
    const { service, prisma } = buildService([]);
    await service.resumenMensual('2026-07');
    const call = (prisma.incidencia.findMany as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(call.select).not.toHaveProperty('alumnoNombre');
    expect(call.select).not.toHaveProperty('relato');
    expect(call.select).not.toHaveProperty('seguimientos');
  });

  it('la respuesta NUNCA contiene alumnoNombre, relato ni seguimientos, aunque la fila de Prisma los traiga', async () => {
    const { service } = buildService([rowWithLeakedFields]);
    const resumen = await service.resumenMensual('2026-07');

    const serialized = JSON.stringify(resumen);
    expect(serialized).not.toContain('Nombre real de alumno');
    expect(serialized).not.toContain('Relato completo de los hechos');
    expect(serialized).not.toContain('seguimiento interno');

    for (const fila of resumen.detalle) {
      expect(fila).not.toHaveProperty('alumnoNombre');
      expect(fila).not.toHaveProperty('relato');
      expect(fila).not.toHaveProperty('seguimientos');
    }
  });

  it('calcula total/abiertas/gravedadAlta/diasMediosHastaCierre y agrupa por tipo/aula', async () => {
    const { service } = buildService([rowWithLeakedFields]);
    const resumen = await service.resumenMensual('2026-07');

    expect(resumen.total).toBe(1);
    expect(resumen.abiertas).toBe(0);
    expect(resumen.gravedadAlta).toBe(1);
    expect(resumen.diasMediosHastaCierre).toBe(3);
    expect(resumen.porTipo).toEqual([{ tipo: 'convivencia', count: 1 }]);
    expect(resumen.porAula).toEqual([{ aulaId: 'aula-1', aulaNombre: '1º DAM - A', count: 1 }]);
    expect(resumen.detalle[0]).toMatchObject({ id: 'inc-1', aulaNombre: '1º DAM - A', diasHastaCierre: 3 });
  });

  it('sin mes explícito usa el mes en curso', async () => {
    const { service, prisma } = buildService([]);
    const resumen = await service.resumenMensual(undefined);
    expect(resumen.mes).toMatch(/^\d{4}-\d{2}$/);
    expect(prisma.incidencia.findMany).toHaveBeenCalled();
  });

  it('responde vacío (sin dividir por cero) cuando no hay incidencias en el mes', async () => {
    const { service } = buildService([]);
    const resumen = await service.resumenMensual('2026-01');
    expect(resumen).toEqual({
      mes: '2026-01',
      total: 0,
      abiertas: 0,
      gravedadAlta: 0,
      diasMediosHastaCierre: null,
      porTipo: [],
      porAula: [],
      detalle: []
    });
  });
});
