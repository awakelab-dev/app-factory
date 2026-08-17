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
// incidencias-aula (2026-08-15): tres roles DISJUNTOS sobre la misma entidad —
// un docente no ve la bandeja de coordinación, ni el resumen de dirección, ni
// la gestión de aulas (esa es solo de admin).
const incidenciasDocente: AuthUser = { ...admin, id: 'u-4', roles: ['incidencias_docente'] };
// reserva-salas (2026-08-16, D-048): roles de negocio SIN admin. La spec
// aprobada no incluía `admin` en ningún @Roles(), a diferencia de
// incidencias-aula que sí lo añade por convención — así que un admin de
// plataforma que no sea empleado ni recepción NO ve el módulo. Es una
// decisión consciente, y este test existe para que se rompa si alguien la
// cambia sin querer.
const empleado: AuthUser = { ...admin, id: 'u-5', roles: ['empleado'] };
const recepcion: AuthUser = { ...admin, id: 'u-6', roles: ['recepcion'] };

const focusFlowNav = ['Enfoque', 'Tareas del día', 'Dashboard', 'Desempeño', 'Configuración'];
const incidenciasNav = ['Registrar incidencia', 'Bandeja', 'Resumen mensual', 'Aulas'];

describe('registry (manifests → menú/rutas)', () => {
  it('admin accede a todos los módulos registrados, con los de sistema (Fábrica y Administración) al final (orden del sidebar, 2026-07-19; hello retirado del registro)', () => {
    const ids = accessibleModules(admin).map((mod) => mod.manifest.id);
    expect(ids).toEqual([
      'moodle-insights',
      'orientador-ia',
      'gestor-proyectos',
      'focus-flow',
      'incidencias-aula',
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
      ...incidenciasNav,
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

  it('un docente de incidencias-aula solo ve "Registrar incidencia" — ni bandeja, ni resumen de dirección, ni aulas (roles disjuntos, 2026-08-15)', () => {
    expect(accessibleModules(incidenciasDocente).map((mod) => mod.manifest.id)).toEqual([
      'moodle-insights',
      'gestor-proyectos',
      'focus-flow',
      'incidencias-aula'
    ]);
    expect(visibleNav(incidenciasDocente).map((item) => item.label)).toEqual([
      'Moodle Insights',
      'Gestor de Proyectos',
      'Proyectos',
      ...focusFlowNav,
      'Registrar incidencia'
    ]);
  });

  it('reserva-salas lo ven empleado y recepción; un admin SIN esos roles no (D-048)', () => {
    expect(accessibleModules(empleado).map((mod) => mod.manifest.id)).toEqual([
      'moodle-insights',
      'gestor-proyectos',
      'focus-flow',
      'reserva-salas'
    ]);
    expect(visibleNav(recepcion).map((item) => item.label)).toEqual([
      'Moodle Insights',
      'Gestor de Proyectos',
      'Proyectos',
      ...focusFlowNav,
      'Reserva de Salas'
    ]);
    // Consecuencia operativa: para verlo en staging hay que darse el rol
    // `empleado` o `recepcion`; ser admin de plataforma no basta.
    expect(accessibleModules(admin).map((mod) => mod.manifest.id)).not.toContain('reserva-salas');
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
