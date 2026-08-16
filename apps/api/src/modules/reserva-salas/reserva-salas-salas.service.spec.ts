import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { AuditService } from '../../core/audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { ReservaSalasPermissionsService } from './reserva-salas-permissions.service';
import { SalasService } from './reserva-salas-salas.service';

const empleado: AuthUser = { id: 'u-empleado', email: 'marta@awakelab.dev', displayName: 'Marta Ruiz', roles: ['empleado'] };
const recepcion: AuthUser = { id: 'u-recepcion', email: 'recepcion@awakelab.dev', displayName: 'Recepción', roles: ['recepcion'] };

const salaRow = {
  id: 'sala-1',
  nombre: 'Cian',
  capacidad: 6,
  equipamiento: 'Proyector',
  activa: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01')
};

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    sala: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([salaRow]),
      create: vi.fn().mockResolvedValue(salaRow),
      update: vi.fn().mockResolvedValue({ ...salaRow, activa: false }),
      ...((overrides.sala as Record<string, unknown>) ?? {})
    },
    reserva: {
      findMany: vi.fn().mockResolvedValue([]),
      ...((overrides.reserva as Record<string, unknown>) ?? {})
    }
  } as unknown as PrismaService;

  const audit = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const permissions = new ReservaSalasPermissionsService();
  return { service: new SalasService(prisma, audit, permissions), prisma, audit };
}

describe('SalasService.listForUser', () => {
  it('sin "todas", filtra por activa=true incluso para recepción', async () => {
    const { service, prisma } = buildService();
    await service.listForUser(recepcion, false);
    expect(prisma.sala.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { activa: true } }));
  });

  it('con "todas=true" y recepción, no filtra por activa (ve también las de baja)', async () => {
    const { service, prisma } = buildService();
    await service.listForUser(recepcion, true);
    expect(prisma.sala.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
  });

  it('con "todas=true" pero siendo empleado, igual filtra solo activas (no confía en el query param)', async () => {
    const { service, prisma } = buildService();
    await service.listForUser(empleado, true);
    expect(prisma.sala.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { activa: true } }));
  });
});

describe('SalasService.create', () => {
  it('crea la sala y audita', async () => {
    const { service, prisma, audit } = buildService();
    const result = await service.create(recepcion, { nombre: 'Cian', capacidad: 6, equipamiento: 'Proyector' });
    expect(prisma.sala.create).toHaveBeenCalledWith({
      data: { nombre: 'Cian', capacidad: 6, equipamiento: 'Proyector' }
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'reserva_salas.sala_creada' }));
    expect(result.nombre).toBe('Cian');
  });

  it('rechaza un nombre de sala duplicado', async () => {
    const { service } = buildService({ sala: { findUnique: vi.fn().mockResolvedValue(salaRow) } });
    await expect(service.create(recepcion, { nombre: 'Cian', capacidad: 6 })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

describe('SalasService.update', () => {
  it('lanza NotFound si la sala no existe', async () => {
    const { service } = buildService();
    await expect(service.update(recepcion, 'sala-x', { capacidad: 8 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('edita capacidad/equipamiento sin tocar "activa"', async () => {
    const { service, prisma, audit } = buildService({
      sala: { findUnique: vi.fn().mockResolvedValue(salaRow), update: vi.fn().mockResolvedValue({ ...salaRow, capacidad: 8 }) }
    });
    const result = await service.update(recepcion, 'sala-1', { capacidad: 8 });
    expect(result.capacidad).toBe(8);
    expect(prisma.sala.update).toHaveBeenCalledWith({
      where: { id: 'sala-1' },
      data: { nombre: undefined, capacidad: 8, equipamiento: undefined }
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'reserva_salas.sala_actualizada' }));
  });

  it('rechaza renombrar a un nombre ya usado por otra sala', async () => {
    const { service } = buildService({
      sala: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(salaRow) // exists
          .mockResolvedValueOnce({ ...salaRow, id: 'sala-2', nombre: 'Índigo' }) // clash
      }
    });
    await expect(service.update(recepcion, 'sala-1', { nombre: 'Índigo' })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('permite renombrar a su propio nombre actual (no es un clash consigo misma)', async () => {
    const { service, prisma } = buildService({
      sala: { findUnique: vi.fn().mockResolvedValue(salaRow), update: vi.fn().mockResolvedValue(salaRow) }
    });
    await service.update(recepcion, 'sala-1', { nombre: 'Cian' });
    expect(prisma.sala.findUnique).toHaveBeenCalledTimes(1); // no se disparó el chequeo de clash
  });
});

describe('SalasService.toggleActiva', () => {
  it('lanza NotFound si la sala no existe', async () => {
    const { service } = buildService();
    await expect(service.toggleActiva(recepcion, 'sala-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('alterna "activa" SIN comprobar reservas futuras (gate técnico: baja permitida con confirmación del frontend)', async () => {
    const { service, prisma, audit } = buildService({
      sala: { findUnique: vi.fn().mockResolvedValue(salaRow), update: vi.fn().mockResolvedValue({ ...salaRow, activa: false }) }
    });
    const result = await service.toggleActiva(recepcion, 'sala-1');
    expect(result.activa).toBe(false);
    expect(prisma.sala.update).toHaveBeenCalledWith({ where: { id: 'sala-1' }, data: { activa: false } });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reserva_salas.sala_toggle_activa', metadata: { activa: false } })
    );
  });

  it('reactiva una sala de baja (toggle es simétrico)', async () => {
    const inactiva = { ...salaRow, activa: false };
    const { service, prisma } = buildService({
      sala: { findUnique: vi.fn().mockResolvedValue(inactiva), update: vi.fn().mockResolvedValue({ ...inactiva, activa: true }) }
    });
    const result = await service.toggleActiva(recepcion, 'sala-1');
    expect(result.activa).toBe(true);
    expect(prisma.sala.update).toHaveBeenCalledWith({ where: { id: 'sala-1' }, data: { activa: true } });
  });
});

describe('SalasService.detail (rejilla del calendario)', () => {
  it('lanza NotFound si la sala no existe', async () => {
    const { service } = buildService();
    await expect(service.detail(empleado, 'sala-x', '2026-08-20')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marca "tuya" la franja reservada por el usuario actual, sin ocupantePorLabel', async () => {
    const { service } = buildService({
      sala: { findUnique: vi.fn().mockResolvedValue(salaRow) },
      reserva: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'r-1', salaId: 'sala-1', hora: '09:00', userId: 'u-empleado', personaNombre: 'Marta Ruiz' }])
      }
    });
    const detail = await service.detail(empleado, 'sala-1', '2026-08-20');
    const slot = detail.franjas.find((f) => f.hora === '09:00');
    expect(slot).toEqual({ hora: '09:00', estado: 'tuya', reservaId: 'r-1', ocupantePorLabel: null });
  });

  it('para un empleado, la franja ocupada por OTRO muestra solo el nombre reducido (minimización de datos)', async () => {
    const { service } = buildService({
      sala: { findUnique: vi.fn().mockResolvedValue(salaRow) },
      reserva: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'r-1', salaId: 'sala-1', hora: '10:00', userId: 'u-otro', personaNombre: 'Javier Soto' }])
      }
    });
    const detail = await service.detail(empleado, 'sala-1', '2026-08-20');
    const slot = detail.franjas.find((f) => f.hora === '10:00');
    expect(slot).toEqual({ hora: '10:00', estado: 'ocupada', reservaId: null, ocupantePorLabel: 'Javier' });
  });

  it('para recepción, la franja ocupada por otro muestra el nombre completo', async () => {
    const { service } = buildService({
      sala: { findUnique: vi.fn().mockResolvedValue(salaRow) },
      reserva: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'r-1', salaId: 'sala-1', hora: '10:00', userId: 'u-otro', personaNombre: 'Javier Soto' }])
      }
    });
    const detail = await service.detail(recepcion, 'sala-1', '2026-08-20');
    const slot = detail.franjas.find((f) => f.hora === '10:00');
    expect(slot?.ocupantePorLabel).toBe('Javier Soto');
  });

  it('las franjas sin reserva quedan "libre" sin ninguno de los dos campos identificativos', async () => {
    const { service } = buildService({ sala: { findUnique: vi.fn().mockResolvedValue(salaRow) } });
    const detail = await service.detail(empleado, 'sala-1', '2026-08-20');
    expect(detail.franjas).toHaveLength(7); // FRANJAS: 09-13 + 16-17
    expect(detail.franjas.every((f) => f.estado === 'libre')).toBe(true);
    expect(detail.franjas.every((f) => f.reservaId === null && f.ocupantePorLabel === null)).toBe(true);
  });
});
