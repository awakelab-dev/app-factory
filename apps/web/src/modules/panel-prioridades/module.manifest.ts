import type { ModuleManifest } from '@awk/types';

/**
 * Manifest del módulo Panel de Prioridades.
 *
 * Declara:
 * - Metadata (id, nombre, descripción)
 * - Rutas públicas (ninguna) y privadas (autenticadas)
 * - Roles requeridos (panel_admin)
 * - Flags de sensibilidad de datos (confidencial + datos_personales)
 *
 * El rol `panel_admin` se siembra automáticamente al startup (D-050)
 * desde los manifests registrados, sin necesidad de SQL a mano ni de
 * tocar el schema.prisma de core.
 */

export const panelPrioridadesManifest: ModuleManifest = {
  id: 'panel-prioridades',
  name: 'Panel de Prioridades',
  description: 'Gestión personal de tareas basada en la matriz de Eisenhower con bloques de tiempo y delegaciones',
  requiredRoles: ['panel_admin'],
  navigationItems: [
    {
      label: 'Panel de Prioridades',
      href: '/panel-prioridades',
      icon: 'priority',
      requiredRoles: ['panel_admin']
    }
  ],
  // Flags de sensibilidad (docs/05): datos confidencial + personales combinados
  sensitivityFlags: {
    dataClassification: 'confidencial_y_datos_personales',
    entities: {
      PanelTask: {
        classification: 'confidencial',
        reason: 'Detalle de tareas confidenciales del líder (presupuestos, auditorías, contratos)'
      },
      ScheduleBlock: {
        classification: 'datos_personales',
        reason: 'Carga de trabajo individual, inferible de bloques agendados'
      },
      TeamMember: {
        classification: 'datos_personales',
        reason: 'Nombres de personas del equipo'
      },
      Delegation: {
        classification: 'confidencial_y_datos_personales',
        reason: 'Combinación de tarea confidencial + persona del equipo'
      }
    },
    rlsRequired: true,
    auditRequired: true
  }
};
