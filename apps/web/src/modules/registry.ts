import { canAccess } from '@awk/auth';
import type { AuthUser, NavItem } from '@awk/types';
import { coreAdminModule } from './core-admin';
import { helloModule } from './hello';
import type { ModuleRegistration } from './types';

/**
 * Registro de módulos del shell. Cada módulo nuevo (generado por la fábrica
 * o hecho a mano) se añade aquí — y NADA más: menú y rutas salen del manifest.
 */
export const modules: ModuleRegistration[] = [helloModule, coreAdminModule];

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
  return accessibleModules(user, registrations).flatMap((mod) =>
    mod.manifest.nav.filter((item) => canAccess(user, item.requiredRoles))
  );
}
