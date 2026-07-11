import { z } from 'zod';

/**
 * @awk/types — contratos compartidos front↔back.
 * Cada endpoint de la API define aquí su schema Zod: un solo esquema da
 * validación runtime (API), tipos TS (web y api) y, más adelante, OpenAPI.
 */

// ---------------------------------------------------------------------------
// Hello (demo end-to-end de Fase 0)
// ---------------------------------------------------------------------------

export const helloResponseSchema = z.object({
  service: z.string(),
  message: z.string(),
  timestamp: z.iso.datetime()
});

export type HelloResponse = z.infer<typeof helloResponseSchema>;

// ---------------------------------------------------------------------------
// Auth (core). El dev-login es temporal hasta que haya IdP (ver STATUS).
// ---------------------------------------------------------------------------

/** Usuario autenticado tal como viaja entre api y web. */
export const authUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  displayName: z.string(),
  roles: z.array(z.string())
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const devLoginRequestSchema = z.object({
  email: z.email()
});

export type DevLoginRequest = z.infer<typeof devLoginRequestSchema>;

export const devLoginResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema
});

export type DevLoginResponse = z.infer<typeof devLoginResponseSchema>;

// ---------------------------------------------------------------------------
// Usuarios del core (GET /api/core/users — solo admin)
// ---------------------------------------------------------------------------

export const coreUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  displayName: z.string(),
  isActive: z.boolean(),
  roles: z.array(z.string()),
  createdAt: z.iso.datetime()
});

export type CoreUser = z.infer<typeof coreUserSchema>;

export const coreUsersResponseSchema = z.array(coreUserSchema);

// ---------------------------------------------------------------------------
// Manifest de módulo. Cada módulo (generado por la fábrica o hecho a mano)
// declara uno; el shell de apps/web construye menú y rutas a partir de él.
// Es data serializable a propósito: más adelante la API podrá servir los
// manifests activos por tenant/rol.
// ---------------------------------------------------------------------------

export const navItemSchema = z.object({
  label: z.string(),
  /** Ruta absoluta dentro del shell (p. ej. "/admin/usuarios"). */
  path: z.string().startsWith('/'),
  /** Roles que ven este ítem; ausente o vacío = visible para cualquier usuario autenticado. */
  requiredRoles: z.array(z.string()).optional()
});

export type NavItem = z.infer<typeof navItemSchema>;

export const moduleManifestSchema = z.object({
  /** Slug estable del módulo (kebab-case). */
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string(),
  description: z.string().optional(),
  /** Prefijo de rutas del módulo (p. ej. "/admin"). */
  basePath: z.string().startsWith('/'),
  /** Roles con acceso al módulo completo; ausente o vacío = cualquier usuario autenticado. */
  requiredRoles: z.array(z.string()).optional(),
  /** Ítems que el shell pinta en el menú lateral. */
  nav: z.array(navItemSchema)
});

export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
