import type { ModuleManifest } from '@awk/types';

/**
 * Primer módulo ejemplar de negocio (D-020/D-021/D-022): réplica de solo
 * lectura de una instancia Moodle. Sin requiredRoles: cualquier autenticado
 * ve el dashboard; la acción de sincronizar se restringe a admin dentro de
 * la página y se vuelve a exigir en la API (@Roles('admin') en POST /sync) —
 * el filtrado del shell nunca es el único punto de control de permisos.
 */
export const moodleInsightsManifest: ModuleManifest = {
  id: 'moodle-insights',
  name: 'Moodle Insights',
  description: 'Cursos, alumnos y calificaciones replicados de una instancia Moodle',
  basePath: '/moodle-insights',
  nav: [{ label: 'Moodle Insights', path: '/moodle-insights', icon: 'GraduationCap' }]
};
