import { canAccess } from '@awk/auth';
import { moduleManifestSchema, type AuthUser, type NavItem } from '@awk/types';
import type { ModuleRegistration, ModuleRoute } from './types';

/**
 * Registro de módulos del shell — **por descubrimiento, no por registro**
 * (incremento D, bloque 1).
 *
 * Hasta 2026-08-17 este archivo importaba y listaba a mano cada módulo, así
 * que todo módulo generado por la Fábrica exigía un "commit de integración"
 * humano que tocaba este archivo y `apps/api/src/app.module.ts` — justo los
 * dos archivos que el guardarraíl de generación prohíbe al agente (y con
 * razón). En D-049 ese cableado se entregó a medias y el módulo quedó
 * compilando pero invisible para todo el mundo.
 *
 * La salida no fue ampliar el guardarraíl: es que el cableado **deje de
 * existir como tarea**. Cada carpeta de `src/modules/` que exporte un
 * `ModuleRegistration` desde su `index.tsx` está registrada por el hecho de
 * existir. Un módulo nuevo = una carpeta nueva; nada más.
 *
 * Notas de implementación:
 *  - `import.meta.glob` con `eager: true` se resuelve en BUILD TIME (Vite y
 *    vitest lo convierten en imports estáticos), así que el grafo de módulos es
 *    exactamente el que había con los imports a mano: **cero cambio en el
 *    bundle ni en el tree-shaking**. (Un glob lazy + `React.lazy` partiría el
 *    bundle por módulo; es otra decisión y no entra aquí.)
 *  - Un `index.tsx` que no exporte un `ModuleRegistration` válido NO tumba la
 *    plataforma: se anota en `REGISTRY_ISSUES` y se salta. `registry.test.ts`
 *    assertea que esa lista está vacía, así que el fallo sale en CI y no en
 *    staging.
 */

/**
 * Módulos de SISTEMA: van al final del sidebar y en ESTE orden fijo (pedido de
 * Leonardo 2026-07-19: Fábrica penúltima, Administración última). El Layout los
 * separa además con una línea.
 */
export const SYSTEM_MODULE_IDS: readonly string[] = ['factory-console', 'core-admin'];

/** Problemas de descubrimiento (los assertea `registry.test.ts`). */
export const REGISTRY_ISSUES: string[] = [];

function isModuleRegistration(value: unknown): value is ModuleRegistration {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ModuleRegistration>;
  if (!Array.isArray(candidate.routes)) return false;
  return moduleManifestSchema.safeParse(candidate.manifest).success;
}

/**
 * Orden del sidebar: negocio primero (alfabético por nombre visible, criterio
 * español) y los de sistema al final, en el orden de `SYSTEM_MODULE_IDS`.
 * Alfabético y no cronológico a propósito (decisión 2026-08-17): se mantiene
 * solo y no obliga a cada módulo generado a elegir un número de orden.
 */
export function sortModules(registrations: ModuleRegistration[]): ModuleRegistration[] {
  const business = registrations.filter((mod) => !SYSTEM_MODULE_IDS.includes(mod.manifest.id));
  const system = registrations.filter((mod) => SYSTEM_MODULE_IDS.includes(mod.manifest.id));
  business.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name, 'es'));
  system.sort(
    (a, b) => SYSTEM_MODULE_IDS.indexOf(a.manifest.id) - SYSTEM_MODULE_IDS.indexOf(b.manifest.id)
  );
  return [...business, ...system];
}

/** Extrae los `ModuleRegistration` de lo que devuelve el glob (o de un mock, en tests). */
export function collectModules(
  discovered: Record<string, unknown>,
  issues: string[] = REGISTRY_ISSUES
): ModuleRegistration[] {
  const found: ModuleRegistration[] = [];
  for (const [path, mod] of Object.entries(discovered).sort(([a], [b]) => a.localeCompare(b))) {
    const exported = Object.values((mod ?? {}) as Record<string, unknown>).filter(isModuleRegistration);
    if (exported.length === 0) {
      issues.push(`${path} no exporta ningún ModuleRegistration válido (manifest + routes) — módulo NO registrado.`);
      continue;
    }
    if (exported.length > 1) {
      issues.push(`${path} exporta ${exported.length} ModuleRegistration; se espera exactamente uno.`);
      continue;
    }
    found.push(exported[0] as ModuleRegistration);
  }
  return sortModules(found);
}

/** Primer segmento del basePath: el "namespace" de rutas del módulo. */
function routeNamespace(basePath: string): string {
  return `/${basePath.split('/').filter(Boolean)[0] ?? ''}`;
}

/**
 * Invariantes que ya no garantiza "estar en la lista" (las usa el test): ids y
 * basePaths únicos, y ninguna ruta ni ítem de menú fuera del terreno del módulo.
 *
 * Las rutas privadas y el menú se exigen dentro del `basePath`; las PÚBLICAS
 * (D-027) solo dentro del namespace, porque `orientador-ia` es legítimamente
 * así: su basePath es `/orientador-ia/admin` (el panel) y la landing del
 * candidato vive en la raíz `/orientador-ia`.
 */
export function findRegistryProblems(registrations: ModuleRegistration[]): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  const seenBasePaths = new Set<string>();
  for (const mod of registrations) {
    const { id, basePath, nav } = mod.manifest;
    if (seenIds.has(id)) problems.push(`id de módulo duplicado: "${id}".`);
    seenIds.add(id);
    if (seenBasePaths.has(basePath)) problems.push(`basePath duplicado: "${basePath}" (módulo "${id}").`);
    seenBasePaths.add(basePath);
    for (const item of nav) {
      if (!item.path.startsWith(basePath)) {
        problems.push(`"${id}": el ítem de menú "${item.label}" (${item.path}) cae fuera de su basePath ${basePath}.`);
      }
    }
    for (const route of mod.routes) {
      if (!route.path.startsWith(basePath)) {
        problems.push(`"${id}": la ruta ${route.path} cae fuera de su basePath ${basePath}.`);
      }
    }
    const namespace = routeNamespace(basePath);
    for (const route of mod.publicRoutes ?? []) {
      if (!route.path.startsWith(namespace)) {
        problems.push(`"${id}": la ruta pública ${route.path} cae fuera de su namespace ${namespace}.`);
      }
    }
  }
  return problems;
}

/** Módulos descubiertos, ya ordenados como los pinta el sidebar. */
export const modules: ModuleRegistration[] = collectModules(
  import.meta.glob('./*/index.tsx', { eager: true })
);

if (REGISTRY_ISSUES.length > 0) {
  // Visible en la consola del navegador y en el log de CI; el test lo convierte
  // en fallo. No lanzamos: un módulo mal exportado no debe tumbar el shell.
  console.error(`Registro de módulos con problemas:\n- ${REGISTRY_ISSUES.join('\n- ')}`);
}

/** Módulos a los que el usuario puede entrar (regla canAccess de @awk/auth). */
export function accessibleModules(
  user: AuthUser,
  registrations: ModuleRegistration[] = modules
): ModuleRegistration[] {
  return registrations.filter((mod) => canAccess(user, mod.manifest.requiredRoles));
}

/** Ítems de menú visibles: filtra por roles a nivel módulo y a nivel ítem. */
export function visibleNav(
  user: AuthUser,
  registrations: ModuleRegistration[] = modules
): NavItem[] {
  return visibleNavGroups(user, registrations).flatMap((group) => group.items);
}

/** Grupo de navegación de un módulo (pedido de Leonardo 2026-07-19: con
 * módulos de varias secciones, el sidebar plano no dejaba ver a qué módulo
 * pertenece cada ítem). El shell decide cómo pintarlo (Layout agrupa bajo
 * cabecera solo los módulos con 2+ ítems). */
export interface NavGroup {
  moduleId: string;
  moduleName: string;
  items: NavItem[];
}

/** visibleNav agrupado por módulo, mismo filtrado por roles a ambos niveles. */
export function visibleNavGroups(
  user: AuthUser,
  registrations: ModuleRegistration[] = modules
): NavGroup[] {
  return accessibleModules(user, registrations)
    .map((mod) => ({
      moduleId: mod.manifest.id,
      moduleName: mod.manifest.name,
      items: mod.manifest.nav.filter((item) => canAccess(user, item.requiredRoles))
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Módulo al que entra el índice `/` cuando el usuario tiene acceso.
 *
 * Existe porque con el descubrimiento automático "el primer módulo del menú"
 * dejó de ser una decisión y pasó a ser un accidente del alfabeto: el día que
 * la Fábrica genere un módulo que ordene antes, la portada de la plataforma
 * cambiaría sola y sin que nadie lo pidiera. La portada se declara aquí.
 */
export const DEFAULT_HOME_MODULE_ID = 'moodle-insights';

/**
 * Ruta de entrada para un usuario: la portada declarada si puede verla, y si no
 * el primer ítem visible de su menú (un gerente sin acceso a la portada entra a
 * lo suyo). `undefined` si no tiene ningún módulo.
 */
export function homePathFor(user: AuthUser, registrations: ModuleRegistration[] = modules): string | undefined {
  const groups = visibleNavGroups(user, registrations);
  const preferred = groups.find((group) => group.moduleId === DEFAULT_HOME_MODULE_ID);
  return (preferred ?? groups[0])?.items[0]?.path;
}

/**
 * Rutas públicas (sin login) de todos los módulos (D-027) — independientes
 * del usuario/roles, a diferencia de accessibleModules/visibleNav.
 */
export function publicModuleRoutes(registrations: ModuleRegistration[] = modules): ModuleRoute[] {
  return registrations.flatMap((mod) => mod.publicRoutes ?? []);
}
