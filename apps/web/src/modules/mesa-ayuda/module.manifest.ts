import type { ModuleManifest } from '@awk/types';

/**
 * Registro de Mesa de Ayuda Awakelab (spec-tecnica.md `mesa-ayuda`):
 * sistema de gestión de tickets de soporte técnico con SLA, asignación de
 * agentes, base de conocimiento (KB) y respuestas preformuladas.
 *
 * Patrón de acceso:
 * - Rutas públicas: crear ticket, ver ticket (con sessionToken)
 * - Rutas autenticadas: panel de agente, listado de tickets, admin
 *
 * Roles nuevos de manifest: `mesa_ayuda_agente` (puede ver/actualizar tickets)
 * y `mesa_ayuda_admin` (configuración completa). Sin `admin` global aquí
 * porque la spec técnica aprobada no requiere permisos de admin de plataforma.
 *
 * NOTA (docs/04, paso 4): este manifest todavía no está registrado en
 * `apps/web/src/modules/registry.ts` ni el módulo de Nest en
 * `apps/api/src/app.module.ts` — ese cableado cruza fuera de esta carpeta
 * y queda para el paso de integración/PR review.
 */
export const mesaAyudaManifest: ModuleManifest = {
  id: 'mesa-ayuda',
  name: 'Mesa de Ayuda',
  description: 'Sistema de gestión de tickets de soporte técnico con SLA y base de conocimiento',
  basePath: '/mesa-ayuda',
  requiredRoles: ['mesa_ayuda_agente', 'mesa_ayuda_admin'],
  nav: [
    {
      label: 'Panel de Soporte',
      path: '/mesa-ayuda/panel',
      requiredRoles: ['mesa_ayuda_agente', 'mesa_ayuda_admin'],
      icon: 'Headphones'
    },
    {
      label: 'Tickets',
      path: '/mesa-ayuda/tickets',
      requiredRoles: ['mesa_ayuda_agente', 'mesa_ayuda_admin'],
      icon: 'Ticket'
    },
    {
      label: 'Administración',
      path: '/mesa-ayuda/admin',
      requiredRoles: ['mesa_ayuda_admin'],
      icon: 'Settings'
    }
  ]
};
