import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@awk/types';
import { accessibleModules, publicModuleRoutes, visibleNav, visibleNavGroups } from './registry';

const admin: AuthUser = {
  id: 'u-1',
  email: 'a@awakelab.dev',
  displayName: 'Admin',
  roles: ['admin']
};
const plain: AuthUser = { ...admin, id: 'u-2', roles: ['user'] };
const orientadorAdmin: AuthUser = { ...admin, id: 'u-3', roles: ['orientador_admin'] };

const focusFlowNav = ['Enfoque', 'Tareas del día', 'Dashboard', 'Desempeño', 'Configuración'];

describe('registry (manifests → menú/rutas)', () => {
  it('admin accede a todos los módulos registrados, con los de sistema (Fábrica y Administración) al final (orden del sidebar, 2026-07-19; hello retirado del registro)', () => {
    const ids = accessibleModules(admin).map((mod) => mod.manifest.id);
    expect(ids).toEqual([
      'moodle-insights',
      'orientador-ia',
      'gestor-proyectos',
      'focus-flow',
      'factory-console',
      'core-admin'
    ]);
  });

  it('un usuario sin admin no accede a core-admin ni factory-console (moodle-insights, gestor-proyectos y focus-flow sí, sin requiredRoles)', () => {
    const ids = accessibleModules(plain).map((mod) => mod.manifest.id);
    expect(ids).toEqual(['moodle-insights', 'gestor-proyectos', 'focus-flow']);
  });

  it('un admin de Aspasia (orientador_admin) ve orientador-ia pero no core-admin ni la fábrica', () => {
    const ids = accessibleModules(orientadorAdmin).map((mod) => mod.manifest.id);
    expect(ids).toEqual(['moodle-insights', 'orientador-ia', 'gestor-proyectos', 'focus-flow']);
  });

  it('el menú se filtra por roles a nivel ítem', () => {
    expect(visibleNav(admin).map((item) => item.label)).toEqual([
      'Moodle Insights',
      'Orientador IA',
      'Gestor de Proyectos',
      'Proyectos',
      ...focusFlowNav,
      'Fábrica',
      'Usuarios'
    ]);
    expect(visibleNav(plain).map((item) => item.label)).toEqual([
      'Moodle Insights',
      'Gestor de Proyectos',
      'Proyectos',
      ...focusFlowNav
    ]);
    expect(visibleNav(orientadorAdmin).map((item) => item.label)).toEqual([
      'Moodle Insights',
      'Orientador IA',
      'Gestor de Proyectos',
      'Proyectos',
      ...focusFlowNav
    ]);
  });

  it('visibleNavGroups agrupa los ítems por módulo con su nombre de manifest (sidebar por "carpetas", 2026-07-19)', () => {
    const groups = visibleNavGroups(plain);
    expect(groups.map((g) => [g.moduleName, g.items.length])).toEqual([
      ['Moodle Insights', 1],
      ['Gestor de Proyectos', 2],
      ['FocusFlow', 5]
    ]);
    // El aplanado de visibleNav sale de los mismos grupos (una sola fuente).
    expect(visibleNav(plain).map((i) => i.label)).toEqual(groups.flatMap((g) => g.items.map((i) => i.label)));
  });

  it('publicModuleRoutes (D-027) expone la landing del candidato y el mercado de orientador-ia sin depender de ningún usuario', () => {
    const paths = publicModuleRoutes().map((route) => route.path);
    expect(paths).toEqual(['/orientador-ia', '/orientador-ia/mercado']);
  });
});
