/**
 * @awk/auth — contratos y helpers de autenticación/autorización.
 * La identidad real vendrá del IdP (decisión pendiente: Entra ID vs Keycloak,
 * ver docs/03-arquitectura.md y STATUS.md). Mientras tanto la API emite JWT
 * propios de plataforma contra usuarios sembrados (dev-login).
 * Estos contratos NO cambian cuando llegue el IdP: solo cambia quién autentica.
 */
import type { AuthUser } from '@awk/types';

export type { AuthUser };

/** Claims del JWT emitido por la plataforma (no por el IdP). */
export interface JwtPayload {
  /** id de usuario en la plataforma */
  sub: string;
  email: string;
  /** displayName del usuario (claim propio) */
  name: string;
  /** roles globales de plataforma; los permisos por módulo viven en cada manifest */
  roles: string[];
  exp?: number;
  iat?: number;
}

export function hasRole(user: Pick<AuthUser, 'roles'>, role: string): boolean {
  return user.roles.includes(role);
}

/**
 * Regla única de acceso por roles (la usan el RolesGuard de la API y el
 * filtrado de menú/rutas del shell web): sin requisitos = acceso para
 * cualquier autenticado; con requisitos = basta UN rol coincidente.
 */
export function canAccess(user: Pick<AuthUser, 'roles'>, requiredRoles?: string[]): boolean {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  return requiredRoles.some((role) => hasRole(user, role));
}

/** Convierte un JwtPayload verificado en el AuthUser que viaja por la app. */
export function payloadToUser(payload: JwtPayload): AuthUser {
  return {
    id: payload.sub,
    email: payload.email,
    displayName: payload.name,
    roles: payload.roles
  };
}
