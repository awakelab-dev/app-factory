import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { AuditService } from '../../core/audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { ReservaSalasPermissionsService } from './reserva-salas-permissions.service';
import { ReservasService } from './reserva-salas-reservas.service';

const empleado: AuthUser = { id: 'u-empleado', email: 'marta@awakelab.dev', displayName: 'Marta Ruiz', roles: ['empleado'] };
const recepcion: AuthUser = { id: 'u-recepcion', email: 'recepcion@awakelab.dev', displayName: 'Recepción', roles: ['recepcion'] };

const salaActiva = {
  id: 'sala-1',
  nombre: 'Cian',
  capacidad: 6,
  equipamiento: null,
  activa: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01')
};
const salaBaja = { ...salaActiva, id: 'sala-2', nombre: 'Índigo', activa: false };

const reservaRow = {
  id: 'reserva-1',
  salaId: 'sala-1',
  fecha: new Date('2026-08-20T00:00:00.000Z'),
  hora: '09:00',
  userId: 'u-empleado',
  personaNombre: 'Marta Ruiz',
  motivo: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  canceladaAt: null
};

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    sala: {
      findUnique: vi.fn().mockResolvedValue(salaActiva),
      findMany: vi.fn().mockResolvedValue([salaActiva]),
      ...((overrides.sala as Record<string, unknown>) ?? {})
    },
    reserva: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(reservaRow),
      update: vi.fn().mockResolvedValue({ ...reservaRow, canceladaAt: new Date('2026-08-15T00:00:00.000Z') }),
      ...((overrides.reserva as Record<string, unknown>) ?? {})
    }
  } as unknown as PrismaService;

  const audit = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const permissions = new ReservaSalasPermissionsService();
  return { service: new ReservasService(prisma, audit, permissions), prisma, audit };
}

// "Hoy" para todos estos tests: fijamos fechas de sobra en el futuro/pasado
// respecto a la fecha real de ejecución no es viable (no hay reloj
// inyectable en el servicio de reservas), así que las pruebas de "fecha
// pasada" usan una fecha fija muy anterior (2020) y las de flujo normal usan
// una fecha muy futura (2099) para no depender de "hoy".

describe('ReservasService.create', () => {
  it('crea la reserva a nombre del propio empleado, ignorando personaNombre del body', async () => {
    const { service, prisma, audit } = buildService();
    const result = await service.create(empleado, { salaId: 'sala-1', fecha: '2099-01-10', hora: '09:00', personaNombre: 'Otro' });
    expect(prisma.reserva.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ personaNombre: 'Marta Ruiz', userId: 'u-empleado' }) })
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'reserva_salas.reserva_creada' }));
    expect(result.salaNombre).toBe('Cian');
  });

  it('recepción puede reservar a nombre de un tercero', async () => {
    const { service, prisma } = buildService();
    await service.create(recepcion, { salaId: 'sala-1', fecha: '2099-01-10', hora: '09:00', personaNombre: 'Javier Soto (visita)' });
    expect(prisma.reserva.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ personaNombre: 'Javier Soto (visita)' }) })
    );
  });

  it('recepción sin personaNombre cae a su propio displayName', async () => {
    const { service, prisma } = buildService();
    await service.create(recepcion, { salaId: 'sala-1', fecha: '2099-01-10', hora: '09:00' });
    expect(prisma.reserva.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ personaNombre: 'Recepción' }) })
    );
  });

  it('rechaza si la sala no existe', async () => {
    const { service } = buildService({ sala: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(
      service.create(empleado, { salaId: 'sala-x', fecha: '2099-01-10', hora: '09:00' })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza si la sala está de baja', async () => {
    const { service } = buildService({ sala: { findUnique: vi.fn().mockResolvedValue(salaBaja) } });
    await expect(
      service.create(empleado, { salaId: 'sala-2', fecha: '2099-01-10', hora: '09:00' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza fechas pasadas', async () => {
    const { service } = buildService();
    await expect(
      service.create(empleado, { salaId: 'sala-1', fecha: '2020-01-01', hora: '09:00' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('devuelve 409 si la franja ya está reservada (conflicto)', async () => {
    const { service } = buildService({ reserva: { findFirst: vi.fn().mockResolvedValue(reservaRow) } });
    await expect(
      service.create(empleado, { salaId: 'sala-1', fecha: '2099-01-10', hora: '09:00' })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('el chequeo de conflicto solo considera reservas no canceladas de la misma tupla', async () => {
    const { service, prisma } = buildService();
    await service.create(empleado, { salaId: 'sala-1', fecha: '2099-01-10', hora: '09:00' });
    expect(prisma.reserva.findFirst).toHaveBeenCalledWith({
      where: { salaId: 'sala-1', fecha: expect.any(Date), hora: '09:00', canceladaAt: null }
    });
  });
});

describe('ReservasService.list', () => {
  it('empleado ve solo las suyas (filtro userId)', async () => {
    const { service, prisma } = buildService();
    await service.list(empleado, {});
    expect(prisma.reserva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u-empleado' }) })
    );
  });

  it('recepción ve todas (sin filtro userId)', async () => {
    const { service, prisma } = buildService();
    await service.list(recepcion, {});
    const call = (prisma.reserva.findMany as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(call.where.userId).toBeUndefined();
  });

  it('un empleado no puede forzar `desde` en el pasado vía query param (se revalida en el backend)', async () => {
    const { service, prisma } = buildService();
    await service.list(empleado, { desde: '2020-01-01' });
    const call = (prisma.reserva.findMany as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(call.where.fecha.gte.getTime()).toBeGreaterThan(new Date('2020-01-01').getTime());
  });

  it('recepción puede pedir un histórico abierto en el pasado', async () => {
    const { service, prisma } = buildService();
    await service.list(recepcion, { desde: '2020-01-01' });
    expect(prisma.reserva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ fecha: { gte: new Date('2020-01-01T00:00:00.000Z') } }) })
    );
  });
});

describe('ReservasService.cancel', () => {
  it('lanza NotFound si la reserva no existe', async () => {
    const { service } = buildService({ reserva: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(service.cancel(empleado, 'reserva-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza cancelar una reserva ya cancelada', async () => {
    const { service } = buildService({
      reserva: { findUnique: vi.fn().mockResolvedValue({ ...reservaRow, canceladaAt: new Date() }) }
    });
    await expect(service.cancel(empleado, 'reserva-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un empleado NO puede cancelar la reserva de otro', async () => {
    const otroEmpleado: AuthUser = { id: 'u-otro', email: 'otro@awakelab.dev', displayName: 'Otro', roles: ['empleado'] };
    const { service } = buildService({ reserva: { findUnique: vi.fn().mockResolvedValue(reservaRow) } });
    await expect(service.cancel(otroEmpleado, 'reserva-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el empleado dueño puede cancelar la suya (soft delete, no borra la fila)', async () => {
    const { service, prisma, audit } = buildService({ reserva: { findUnique: vi.fn().mockResolvedValue(reservaRow) } });
    await service.cancel(empleado, 'reserva-1');
    expect(prisma.reserva.update).toHaveBeenCalledWith({
      where: { id: 'reserva-1' },
      data: { canceladaAt: expect.any(Date) }
    });
    expect((prisma.reserva as unknown as { delete?: unknown }).delete).toBeUndefined();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'reserva_salas.reserva_cancelada' }));
  });

  it('recepción puede cancelar cualquier reserva', async () => {
    const { service, prisma } = buildService({ reserva: { findUnique: vi.fn().mockResolvedValue(reservaRow) } });
    await service.cancel(recepcion, 'reserva-1');
    expect(prisma.reserva.update).toHaveBeenCalled();
  });
});
