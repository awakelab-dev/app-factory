import { SetMetadata } from '@nestjs/common';

/**
 * Auth del control plane (D-030): la Fábrica NO emite tokens propios —
 * VALIDA el JWT que emite la Plataforma (apps/api, dev-login hoy, IdP
 * mañana). Lo único compartido entre ambos sistemas es el secreto de firma
 * (misma env var JWT_SECRET), nunca la base de datos (D-029).
 *
 * getJwtSecret DEBE mantenerse alineado con
 * apps/api/src/core/auth/auth.constants.ts (mismo secreto, mismo fallback
 * de dev) — si aquello cambia, esto cambia.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatoria en producción');
  }
  return 'awk-dev-secret-no-usar-en-produccion';
}

export const IS_PUBLIC_KEY = 'awk-factory:isPublic';

/** Solo para el healthcheck del contenedor — todo lo demás exige rol admin. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Rol de plataforma exigido para TODO el control plane en esta fase (un solo
 * operador, Leonardo — D-021/D-029). Cuando los gerentes entren al dashboard
 * (Fase 2) se abrirá por gate/rol, no cambiando esta constante a algo laxo.
 */
export const FACTORY_ADMIN_ROLES = ['admin'];
