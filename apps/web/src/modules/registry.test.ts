import { describe, expect, it } from 'vitest';
import type { AuthUser, ModuleManifest } from '@awk/types';
import {
  DEFAULT_HOME_MODULE_ID,
  REGISTRY_ISSUES,
  SYSTEM_MODULE_IDS,
  accessibleModules,
  collectModules,
  findRegistryProblems,
  homePathFor,
  modules,
  publicModuleRoutes,
  sortModules,
  visibleNav,
  visibleNavGroups
} from './registry';

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

function manifest(overrides: Partial<ModuleManifest> & Pick<ModuleManifest, 'id'>): ModuleManifest {
  return {
    name: overrides.id,
    basePath: `/${overrides.id}`,
    nav: [{ label: overrides.id, path: `/${overrides.id}` }],
    ...overrides
  };
}

/**
 * Estos tests dejaron de comprobar "el módulo está en la lista de registry.ts"
 * (2026-08-17, incremento D bloque 1): esa lista ya no existe — los módulos se
 * DESCUBREN por glob de `<slug>/index.tsx`. Lo que se comprueba ahora es lo que
 * el descubrimiento sí puede romper: que cada carpeta aporte un registro
 * válido, que no haya ids/basePaths duplicados ni rutas fuera de su basePath, y
 * el orden del sidebar. El filtrado por roles se sigue comprobando igual.
 */
describe('descubrimiento de módulos (glob de <slug>/index.tsx)', () => {
  it('toda carpeta de modules/ aporta exactamente un ModuleRegistration válido', () => {
    expect(REGISTRY_ISSUES).toEqual([]);
    expect(modules.length).toBeGreaterThanOrEqual(8);
  });

  it('sin ids ni basePaths duplicados, y con cada ruta e ítem de menú dentro de su basePath', () => {
    expect(findRegistryProblems(modules)).toEqual([]);
  });

  it('anota (sin lanzar) una carpeta cuyo index.tsx no exporta un registro válido — el fallo sale en CI, no en staging', () => {
    const issues: string[] = [];
    const found = collectModules(
      {
        './bien/index.tsx': { bienModule: { manifest: manifest({ id: 'bien' }), routes: [] } },
        './mal/index.tsx': { algo: { noEsUnManifest: true } },
        './vacio/index.tsx': {}
      },
      issues
    );
    expect(found.map((mod) => mod.manifest.id)).toEqual(['bien']);
    expect(issues).toHaveLength(2);
    expect(issues.join('\n')).toContain('./mal/index.tsx');
    expect(issues.join('\n')).toContain('./vacio/index.tsx');
  });

  it('ordena negocio alfabéticamente por nombre y deja los de sistema al final, Fábrica antes de Administración', () => {
    const sorted = sortModules([
      { manifest: manifest({ id: 'core-admin', name: 'Administración' }), routes: [] },
      { manifest: manifest({ id: 'zeta', name: 'Zeta' }), routes: [] },
      { manifest: manifest({ id: 'factory-console', name: 'Fábrica' }), routes: [] },
      { manifest: manifest({ id: 'alfa', name: 'Alfa' }), routes: [] },
      { manifest: manifest({ id: 'enie', name: 'Ñu' }), routes: [] }
    ]);
    expect(sorted.map((mod) => mod.manifest.id)).toEqual([
      'alfa',
      'enie',
      'zeta',
      'factory-console',
      'core-admin'
    ]);
    expect(SYSTEM_MODULE_IDS).toEqual(['factory-console', 'core-admin']);
  });
});

describe('registry (manifests → menú/rutas)', () => {
  it('admin accede a todos los módulos que le corresponden, alfabéticos y con los de sistema al final', () => {
    const ids = accessibleModules(admin).map((mod) => mod.manifest.id);
    expect(ids).toEqual([
      'focus-flow',
      'gestor-proyectos',
      'moodle-insights',
      'orientador-ia',
      'incidencias-aula',
      'factory-console',
      'core-admin'
    ]);
    // reserva-salas NO está: su manifest no incluye `admin` (D-048/D-049).
    expect(ids).not.toContain('reserva-salas');
  });

  it('un usuario sin admin no accede a core-admin ni factory-console (moodle-insights, gestor-proyectos y focus-flow sí, sin requiredRoles)', () => {
    const ids = accessibleModules(plain).map((mod) => mod.manifest.id);
    expect(ids).toEqual(['focus-flow', 'gestor-proyectos', 'moodle-insights']);
  });

  it('un admin de Aspasia (orientador_admin) ve orientador-ia pero no core-admin ni la fábrica', () => {
    const ids = accessibleModules(orientadorAdmin).map((mod) => mod.manifest.id);
    expect(ids).toEqual(['focus-flow', 'gestor-proyectos', 'moodle-insights', 'orientador-ia']);
  });

  it('el menú se filtra por roles a nivel ítem', () => {
    expect(visibleNav(admin).map((item) => item.label)).toEqual([
      ...focusFlowNav,
      'Gestor de Proyectos',
      'Proyectos',
      'Moodle Insights',
      'Orientador IA',
      ...incidenciasNav,
      'Fábrica',
      'Usuarios'
    ]);
    expect(visibleNav(plain).map((item) => item.label)).toEqual([
      ...focusFlowNav,
      'Gestor de Proyectos',
      'Proyectos',
      'Moodle Insights'
    ]);
    expect(visibleNav(orientadorAdmin).map((item) => item.label)).toEqual([
      ...focusFlowNav,
      'Gestor de Proyectos',
      'Proyectos',
      'Moodle Insights',
      'Orientador IA'
    ]);
  });

  it('un docente de incidencias-aula solo ve "Registrar incidencia" — ni bandeja, ni resumen de dirección, ni aulas (roles disjuntos, 2026-08-15)', () => {
    expect(accessibleModules(incidenciasDocente).map((mod) => mod.manifest.id)).toEqual([
      'focus-flow',
      'gestor-proyectos',
      'moodle-insights',
      'incidencias-aula'
    ]);
    expect(visibleNav(incidenciasDocente).map((item) => item.label)).toEqual([
      ...focusFlowNav,
      'Gestor de Proyectos',
      'Proyectos',
      'Moodle Insights',
      'Registrar incidencia'
    ]);
  });

  it('reserva-salas lo ven empleado y recepción; un admin SIN esos roles no (D-048)', () => {
    expect(accessibleModules(empleado).map((mod) => mod.manifest.id)).toEqual([
      'focus-flow',
      'gestor-proyectos',
      'moodle-insights',
      'reserva-salas'
    ]);
    expect(visibleNav(recepcion).map((item) => item.label)).toEqual([
      ...focusFlowNav,
      'Gestor de Proyectos',
      'Proyectos',
      'Moodle Insights',
      'Reserva de Salas'
    ]);
    // Consecuencia operativa: para verlo hay que tener el rol `empleado` o
    // `recepcion`; ser admin de plataforma no basta. Desde el incremento D los
    // dos roles EXISTEN al arrancar la API (siembra desde los @Roles) y se
    // asignan desde /admin/usuarios, sin SQL a mano.
    expect(accessibleModules(admin).map((mod) => mod.manifest.id)).not.toContain('reserva-salas');
  });

  it('visibleNavGroups agrupa los ítems por módulo con su nombre de manifest (sidebar por "carpetas", 2026-07-19)', () => {
    const groups = visibleNavGroups(plain);
    expect(groups.map((g) => [g.moduleName, g.items.length])).toEqual([
      ['FocusFlow', 5],
      ['Gestor de Proyectos', 2],
      ['Moodle Insights', 1]
    ]);
    // El aplanado de visibleNav sale de los mismos grupos (una sola fuente).
    expect(visibleNav(plain).map((i) => i.label)).toEqual(
      groups.flatMap((g) => g.items.map((i) => i.label))
    );
  });

  it('la portada NO es "el primer ítem del menú": es la declarada, y solo cae al primero si el usuario no la ve', () => {
    // Con el descubrimiento automático, "el primero" cambiaría solo en cuanto
    // se genere un módulo que ordene antes alfabéticamente (hoy sería FocusFlow).
    expect(visibleNav(admin)[0]?.path).toBe('/focus-flow');
    expect(homePathFor(admin)).toBe('/moodle-insights');
    expect(homePathFor(plain)).toBe('/moodle-insights');
    // Un usuario que no accede a la portada entra a lo suyo.
    const soloIncidencias: AuthUser = { ...admin, roles: ['incidencias_coordinacion'] };
    const registrations = modules.filter((mod) => mod.manifest.id !== DEFAULT_HOME_MODULE_ID);
    expect(homePathFor(soloIncidencias, registrations)).toBe('/focus-flow');
    expect(homePathFor({ ...admin, roles: [] }, [])).toBeUndefined();
  });

  it('publicModuleRoutes (D-027) expone la landing del candidato y el mercado de orientador-ia sin depender de ningún usuario', () => {
    const paths = publicModuleRoutes().map((route) => route.path);
    expect(paths).toEqual(['/orientador-ia', '/orientador-ia/mercado']);
  });
});
