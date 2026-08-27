import type { ModuleManifest } from '@awk/types';

/**
 * Panel de Prioridades: gestión personal de tareas por urgencia/importancia (matriz de Eisenhower).
 * Módulo monouser con datos confidencial-personales (spec D-056).
 *
 * RLS + RBAC redundante para cumplir docs/05. Rol nuevo `panel_admin` (solo Antonio en MVP).
 * El rol `admin` se agregó tras el primer despliegue (mismo patrón que orientador_admin, D-011).
 */
export const panelPrioritiesManifest: ModuleManifest = {
  id: 'panel-prioridades',
  name: 'Panel de Prioridades',
  description: 'Gestión de tareas por urgencia/importancia (matriz de Eisenhower)',
  basePath: '/panel-prioridades',
  requiredRoles: ['panel_admin', 'admin'],
  nav: [
    {
      label: 'Panel de Prioridades',
      path: '/panel-prioridades',
      requiredRoles: ['panel_admin', 'admin'],
      icon: 'Grid'
    }
  ]
};
