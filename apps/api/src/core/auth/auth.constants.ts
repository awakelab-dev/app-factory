export const IS_PUBLIC_KEY = 'awk:isPublic';
export const ROLES_KEY = 'awk:roles';

/**
 * Secreto de firma de los JWT de plataforma.
 * En producción JWT_SECRET es obligatoria: la API no arranca sin ella.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatoria en producción');
  }
  return 'awk-dev-secret-no-usar-en-produccion';
}

export const JWT_EXPIRES_IN = '8h';
