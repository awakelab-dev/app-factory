import type { ModuleManifest } from '@awk/types';

/**
 * Registro de Mesa de Ayuda Awakelab (spec-tecnica.md `mesa-ayuda`, change-2):
 * sistema de gestión de tickets de soporte técnico con SLA, asignación de
 * agentes, base de conocimiento (KB) y respuestas preformuladas.
 *
 * Patrón de acceso:
 * - Rutas públicas: login, cambiar contraseña, crear ticket, ver ticket
 * - Rutas autenticadas internas: panel de agente, listado de tickets, admin
 * - Rutas autenticadas externas: mis tickets (solo propios), responder
 *
 * Roles nuevos de manifest: `mesa_ayuda_agente` (puede ver/actualizar tickets),
 * `mesa_ayuda_admin` (configuración completa) y `mesa_ayuda_solicitante` (externos).
 * Sin `admin` global aquí porque la spec técnica aprobada no requiere permisos
 * de admin de plataforma.
 *
 * NOTA (docs/04, paso 4): este manifest todavía no está registrado en
 * `apps/web/src/modules/registry.ts` ni el módulo de Nest en
 * `apps/api/src/app.module.ts` — ese cableado cruza fuera de esta carpeta
 * y queda para el paso de integración/PR review.
 *
 * NOTA: change-2 agrega publicRoutes para login/change-password, que deben
 * reconocerse por el shell como rutas sin autenticación requerida.
 */
export const mesaAyudaManifest: ModuleManifest = {
  id: 'mesa-ayuda',
  name: 'Mesa de Ayuda',
  description: 'Sistema de gestión de tickets de soporte técnico con SLA y base de conocimiento',
  basePath: '/mesa-ayuda',
  requiredRoles: ['mesa_ayuda_agente', 'mesa_ayuda_admin', 'mesa_ayuda_solicitante'],
  // NOTA change-2: publicRoutes quedaría aquí, pero el tipo ModuleManifest de @awk/types no lo soporta aún.
  // Las rutas públicas se declaran en index.tsx. El shell debe reconocerlas desde allí (D-050 gap).
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
