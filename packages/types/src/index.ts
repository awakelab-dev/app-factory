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
  requiredRoles: z.array(z.string()).optional(),
  /** Nombre de icono de lucide-react (p. ej. "GraduationCap"); el shell cae a uno por defecto si falta o no lo reconoce. */
  icon: z.string().optional()
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

// ---------------------------------------------------------------------------
// Módulo moodle-insights (primer módulo ejemplar, D-020/D-021/D-022): réplica
// parcial de una instancia Moodle (cursos, alumnos, calificaciones) vía Moodle
// Web Services, disparada a mano con el botón "Actualizar datos" — no hay
// sincronización automática. Ver docs/DECISIONES.md D-022 para el detalle del
// contrato (funciones wsfunction usadas, alcance single-tenant).
// ---------------------------------------------------------------------------

export const moodleSyncStatusSchema = z.enum(['running', 'success', 'error']);
export type MoodleSyncStatus = z.infer<typeof moodleSyncStatusSchema>;

export const moodleSyncRunSchema = z.object({
  id: z.string(),
  status: moodleSyncStatusSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  coursesCount: z.number().int(),
  studentsCount: z.number().int(),
  enrollmentsCount: z.number().int(),
  errorMessage: z.string().nullable()
});
export type MoodleSyncRun = z.infer<typeof moodleSyncRunSchema>;

export const moodleSummarySchema = z.object({
  totalCourses: z.number().int(),
  visibleCourses: z.number().int(),
  totalStudents: z.number().int(),
  totalEnrollments: z.number().int(),
  avgGrade: z.number().nullable(),
  coursesByCategory: z.array(z.object({ categoryName: z.string(), count: z.number().int() })),
  lastSync: moodleSyncRunSchema.nullable()
});
export type MoodleSummary = z.infer<typeof moodleSummarySchema>;

export const moodleCourseRowSchema = z.object({
  id: z.string(),
  moodleId: z.number().int(),
  shortname: z.string(),
  fullname: z.string(),
  categoryName: z.string().nullable(),
  visible: z.boolean(),
  studentsCount: z.number().int(),
  avgGrade: z.number().nullable()
});
export type MoodleCourseRow = z.infer<typeof moodleCourseRowSchema>;
export const moodleCoursesResponseSchema = z.array(moodleCourseRowSchema);

export const moodleStudentRowSchema = z.object({
  id: z.string(),
  moodleId: z.number().int(),
  fullname: z.string(),
  email: z.string(),
  coursesCount: z.number().int(),
  avgGrade: z.number().nullable()
});
export type MoodleStudentRow = z.infer<typeof moodleStudentRowSchema>;
export const moodleStudentsResponseSchema = z.array(moodleStudentRowSchema);
