import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@awk/auth';
import { ReservaSalasPermissionsService } from './reserva-salas-permissions.service';

const empleado: AuthUser = { id: 'u-empleado', email: 'marta@awakelab.dev', displayName: 'Marta Ruiz', roles: ['empleado'] };
const otroEmpleado: AuthUser = { id: 'u-otro', email: 'javier@awakelab.dev', displayName: 'Javier Soto', roles: ['empleado'] };
const recepcion: AuthUser = { id: 'u-recepcion', email: 'recepcion@awakelab.dev', displayName: 'Recepción', roles: ['recepcion'] };
// admin de plataforma SIN empleado/recepcion: la spec técnica aprobada no incluye
// `admin` en ningún @Roles() de este módulo (a diferencia de incidencias-aula).
const admin: AuthUser = { id: 'u-admin', email: 'admin@awakelab.dev', displayName: 'Admin', roles: ['admin'] };

describe('ReservaSalasPermissionsService.isRecepcion', () => {
  const service = new ReservaSalasPermissionsService();

  it('true solo para el rol recepcion', () => {
    expect(service.isRecepcion(recepcion)).toBe(true);
    expect(service.isRecepcion(empleado)).toBe(false);
    expect(service.isRecepcion(admin)).toBe(false);
  });
});

describe('ReservaSalasPermissionsService.canCancel', () => {
  const service = new ReservaSalasPermissionsService();
  const propia = { userId: 'u-empleado' };

  it('el empleado puede cancelar su propia reserva', () => {
    expect(service.canCancel(empleado, propia)).toBe(true);
  });

  it('un empleado NO puede cancelar la reserva de otro empleado', () => {
    expect(service.canCancel(otroEmpleado, propia)).toBe(false);
  });

  it('recepción puede cancelar cualquier reserva, sea o no la suya', () => {
    expect(service.canCancel(recepcion, propia)).toBe(true);
    expect(service.canCancel(recepcion, { userId: 'u-recepcion' })).toBe(true);
  });

  it('admin de plataforma sin rol empleado/recepcion no tiene permiso especial (ni siquiera sobre su propia fila)', () => {
    expect(service.canCancel(admin, { userId: 'u-admin' })).toBe(true); // es la suya, por userId
    expect(service.canCancel(admin, propia)).toBe(false); // ajena y no es recepción
  });
});
