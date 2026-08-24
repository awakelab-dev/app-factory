import type { ModuleManifest } from '@awk/types';

/**
 * Registro de Mesa de Ayuda Awakelab (spec-tecnica.md `mesa-ayuda`):
 * sistema de gestión de tickets de soporte técnico con SLA, asignación de
 * agentes, base de conocimiento (KB) y respuestas preformuladas.
 *
 * Patrón de acceso: todo el módulo va tras el login de la plataforma. No hay
 * rutas públicas ni enlaces con token.
 *
 * Roles de manifest: `mesa_ayuda_solicitante` (abre y sigue sus propias
 * peticiones), `mesa_ayuda_agente` (puede ver/actualizar tickets) y
 * `mesa_ayuda_admin` (configuración completa). Sin `admin` global aquí porque
 * la spec técnica aprobada no requiere permisos de admin de plataforma.
 *
 * PENDIENTE para la Fábrica: la redirección por rol tras el login (el
 * solicitante debe aterrizar en /mesa-ayuda/nuevo en vez de en el escritorio
 * de proyectos) vive en el shell del core y no se toca desde aquí.
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
  requiredRoles: ['mesa_ayuda_solicitante', 'mesa_ayuda_agente', 'mesa_ayuda_admin'],
  nav: [
    {
      label: 'Nueva petición',
      path: '/mesa-ayuda/nuevo',
      requiredRoles: ['mesa_ayuda_solicitante', 'mesa_ayuda_agente', 'mesa_ayuda_admin'],
      icon: 'MessageSquarePlus'
    },
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
