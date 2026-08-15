import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@awk/auth';
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

const propiaIncidencia = { docenteId: 'u-docente' };

describe('IncidenciasPermissionsService.canViewDetail', () => {
  const service = new IncidenciasPermissionsService();

  it('el docente ve el detalle de su propia incidencia', () => {
    expect(service.canViewDetail(docente, propiaIncidencia)).toBe(true);
  });

  it('un docente NO ve el detalle de una incidencia de otro docente', () => {
    expect(service.canViewDetail(otroDocente, propiaIncidencia)).toBe(false);
  });

  it('coordinación ve el detalle de cualquier incidencia', () => {
    expect(service.canViewDetail(coordinacion, propiaIncidencia)).toBe(true);
  });

  it('admin ve el detalle de cualquier incidencia', () => {
    expect(service.canViewDetail(admin, propiaIncidencia)).toBe(true);
  });

  it('dirección NO ve el detalle completo (no es coordinación ni la docente dueña)', () => {
    expect(service.canViewDetail(direccion, propiaIncidencia)).toBe(false);
  });
});

describe('IncidenciasPermissionsService.canAct / isCoordinacion', () => {
  const service = new IncidenciasPermissionsService();

  it('coordinación y admin pueden actuar (tomar/seguimiento/cerrar)', () => {
    expect(service.canAct(coordinacion)).toBe(true);
    expect(service.canAct(admin)).toBe(true);
  });

  it('docente y dirección no pueden actuar', () => {
    expect(service.canAct(docente)).toBe(false);
    expect(service.canAct(direccion)).toBe(false);
  });
});
