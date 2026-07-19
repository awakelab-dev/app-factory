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
  it('admin accede a todos los módulos registrados, incl. orientador-ia (admin también entra ahí desde 2026-07-15), gestor-proyectos y factory-console (D-030)', () => {
    const ids = accessibleModules(admin).map((mod) => mod.manifest.id);
    expect(ids).toEqual(['hello', 'core-admin', 'moodle-insights', 'orientador-ia', 'gestor-proyectos', 'factory-console']);
  });

  it('un usuario sin admin no accede a core-admin (moodle-insights y gestor-proyectos sí, sin requiredRoles)', () => {
    const ids = accessibleModules(plain).map((mod) => mod.manifest.id);
    expect(ids).toEqual(['hello', 'moodle-insights', 'gestor-proyectos']);
  });

  it('un admin de Aspasia (orientador_admin) ve orientador-ia pero no core-admin ni la fábrica', () => {
    const ids = accessibleModules(orientadorAdmin).map((mod) => mod.manifest.id);
    expect(ids).toEqual(['hello', 'moodle-insights', 'orientador-ia', 'gestor-proyectos']);
  });

  it('el menú se filtra por roles a nivel ítem', () => {
    expect(visibleNav(admin).map((item) => item.label)).toEqual([
      'Demo Hello',
      'Usuarios',
      'Moodle Insights',
      'Orientador IA',
      'Gestor de Proyectos',
      'Proyectos',
      'Fábrica'
    ]);
    expect(visibleNav(plain).map((item) => item.label)).toEqual([
      'Demo Hello',
      'Moodle Insights',
      'Gestor de Proyectos',
      'Proyectos'
    ]);
    expect(visibleNav(orientadorAdmin).map((item) => item.label)).toEqual([
      'Demo Hello',
      'Moodle Insights',
      'Orientador IA',
      'Gestor de Proyectos',
      'Proyectos'
    ]);
  });

  it('publicModuleRoutes (D-027) expone la landing del candidato y el mercado de orientador-ia sin depender de ningún usuario', () => {
    const paths = publicModuleRoutes().map((route) => route.path);
    expect(paths).toEqual(['/orientador-ia', '/orientador-ia/mercado']);
  });
});
