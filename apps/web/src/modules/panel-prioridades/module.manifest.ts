import type { ModuleManifest } from '@awk/types';

/**
 * Panel de Prioridades (D-056): matriz de Eisenhower con gestión de tareas,
 * bloques de tiempo semanal, delegaciones e indicadores de carga.
 *
 * Rol nuevo: `panel_admin` (declarado aquí, sin tocar core).
 * Acceso: solo usuarios con rol `panel_admin` o `admin` ven el módulo.
 * Datos: confidencial (tareas), personal (equipo de delegación).
 * RLS + RBAC activos desde el primer día (docs/05-gobernanza-seguridad.md).
 *
 * Referencias: D-011 (rol de manifest), D-056 (spec funcional aprobada),
 * docs/05 (gate técnico: RLS + auditoría obligatoria).
 */
export const panelPrioridadesManifest: ModuleManifest = {
  id: 'panel-prioridades',
  name: 'Panel de Prioridades',
  description: 'Matriz de Eisenhower: gestión de tareas por urgencia/importancia, bloques de tiempo y delegaciones',
  basePath: '/panel-prioridades',
  requiredRoles: ['panel_admin', 'admin'],
  // La clasificación de sensibilidad (confidencial + personal, con auditoría
  // obligatoria) vive en la spec y en el manifest del prototipo: `ModuleManifest`
  // del shell no la contempla, y añadirle campos propios rompe el contrato.
  nav: [{ label: 'Panel de Prioridades', path: '/panel-prioridades', icon: 'Layout' }]
};
