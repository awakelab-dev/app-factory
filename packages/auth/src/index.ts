/**
 * @awk/auth — STUB.
 * La integración real de SSO depende de la decisión IdP pendiente
 * (Entra ID vs Keycloak, ver docs/03-arquitectura.md y STATUS.md).
 * Este paquete fija desde ya los contratos que consumirán api y web,
 * para que el resto del código no cambie cuando llegue el IdP real.
 */

/** Claims del JWT emitido por la plataforma (no por el IdP). */
export interface JwtPayload {
  /** id de usuario en la plataforma */
  sub: string;
  email: string;
  /** roles globales de plataforma; los permisos por módulo viven en cada manifest */
  roles: string[];
  exp?: number;
  iat?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

export function hasRole(user: Pick<AuthUser, 'roles'>, role: string): boolean {
  return user.roles.includes(role);
}

/** Usuario de desarrollo mientras no hay IdP. NUNCA usar en producción. */
export function getDevUser(): AuthUser {
  return {
    id: 'dev-user',
    email: 'dev@awakelab.dev',
    displayName: 'Usuario de desarrollo',
    roles: ['admin']
  };
}
