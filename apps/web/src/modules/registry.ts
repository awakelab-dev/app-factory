import { canAccess } from '@awk/auth';
import type { AuthUser, NavItem } from '@awk/types';
import { coreAdminModule } from './core-admin';
import { factoryConsoleModule } from './factory-console';
import { focusFlowModule } from './focus-flow';
import { gestorProyectosModule } from './gestor-proyectos';
import { moodleInsightsModule } from './moodle-insights';
import { orientadorIaModule } from './orientador-ia';
import type { ModuleRegistration, ModuleRoute } from './types';

/**
 * Registro de módulos del shell. Cada módulo nuevo (generado por la fábrica
 * o hecho a mano) se añade aquí — y NADA más: menú y rutas salen del manifest.
 *
 * El orden ES el orden del sidebar (pedido de Leonardo 2026-07-19): primero
 * los módulos de negocio, y al final los de sistema — Fábrica (penúltimo) y
 * Administración (último), que el Layout separa además con una línea.
 * El módulo demo `hello` se retiró del registro el 2026-07-19 (ya no hace
 * falta); su HelloModule de la API sigue vivo para los smoke tests.
 */
export const modules: ModuleRegistration[] = [
  moodleInsightsModule,
  orientadorIaModule,
  gestorProyectosModule,
  focusFlowModule,
  factoryConsoleModule,
  coreAdminModule
];

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
 * Rutas públicas (sin login) de todos los módulos (D-027) — independientes
 * del usuario/roles, a diferencia de accessibleModules/visibleNav.
 */
export function publicModuleRoutes(registrations: ModuleRegistration[] = modules): ModuleRoute[] {
  return registrations.flatMap((mod) => mod.publicRoutes ?? []);
}
