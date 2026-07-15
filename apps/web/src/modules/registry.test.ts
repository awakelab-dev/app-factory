import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@awk/types';
import { accessibleModules, publicModuleRoutes, visibleNav } from './registry';

const admin: AuthUser = {
  id: 'u-1',
  email: 'a@awakelab.dev',
  displayName: 'Admin',
  roles: ['admin']
};
const plain: AuthUser = { ...admin, id: 'u-2', roles: ['user'] };
const orientadorAdmin: AuthUser = { ...admin, id: 'u-3', roles: ['orientador_admin'] };

describe('registry (manifests → menú/rutas)', () => {
  it('admin accede a todos los módulos registrados, incl. orientador-ia (admin también entra ahí desde 2026-07-15) y factory-console (D-030)', () => {
    const ids = accessibleModules(admin).map((mod) => mod.manifest.id);
    expect(ids).toEqual(['hello', 'core-admin', 'moodle-insights', 'orientador-ia', 'factory-console']);
  });

  it('un usuario sin admin no accede a core-admin (moodle-insights sí, sin requiredRoles)', () => {
    const ids = accessibleModules(plain).map((mod) => mod.manifest.id);
    expect(ids).toEqual(['hello', 'moodle-insights']);
  });

  it('un admin de Aspasia (orientador_admin) solo ve el panel de orientador-ia', () => {
    const ids = accessibleModules(orientadorAdmin).map((mod) => mod.manifest.id);
    expect(ids).toEqual(['hello', 'moodle-insights', 'orientador-ia']);
  });

  it('el menú se filtra por roles a nivel ítem', () => {
    expect(visibleNav(admin).map((item) => item.label)).toEqual([
      'Demo Hello',
      'Usuarios',
      'Moodle Insights',
      'Orientador IA',
      'Fábrica'
    ]);
    expect(visibleNav(plain).map((item) => item.label)).toEqual(['Demo Hello', 'Moodle Insights']);
    expect(visibleNav(orientadorAdmin).map((item) => item.label)).toEqual([
      'Demo Hello',
      'Moodle Insights',
      'Orientador IA'
    ]);
  });

  it('publicModuleRoutes (D-027) expone la landing del candidato y el mercado de orientador-ia sin depender de ningún usuario', () => {
    const paths = publicModuleRoutes().map((route) => route.path);
    expect(paths).toEqual(['/orientador-ia', '/orientador-ia/mercado']);
  });
});
