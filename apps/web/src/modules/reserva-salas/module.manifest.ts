import type { ModuleManifest } from '@awk/types';

/**
 * Registro de Reserva de Salas (spec-tecnica.md `reserva-salas`): reemplaza
 * la hoja de cálculo compartida y los avisos por chat del prototipo. Un
 * único ítem de navegación: a diferencia de `incidencias-aula` (una página
 * por rol), este módulo replica el prototipo original — UNA página
 * (`ReservaSalasPage.tsx`) con vistas internas (Calendario / Mis reservas /
 * Catálogo) conmutadas por estado de React, no por rutas — spec-tecnica.md
 * "Frontend" describe `ReservaSalasPage.tsx` como "contenedor principal,
 * gestión de vistas". La vista "Catálogo" solo se pinta si el usuario tiene
 * el rol `recepcion` (gate funcional, decisión 4: gestión de salas es
 * exclusiva de Recepción) — chequeo redundante con el 403 del backend, no
 * el único control de seguridad.
 *
 * Roles nuevos de manifest: `empleado` y `recepcion` (spec-tecnica.md
 * "Reutilización del core"). Sin `admin`: la spec técnica aprobada de este
 * módulo no lo incluye en ningún `@Roles()` (a diferencia de
 * `incidencias-aula`, que sí lo añade por convención) — un admin de
 * plataforma sin uno de estos dos roles no entra.
 *
 * NOTA (docs/04, paso 4 — "solo puede tocar las carpetas de su módulo"): este
 * manifest todavía no está registrado en `apps/web/src/modules/registry.ts`
 * ni el módulo de Nest en `apps/api/src/app.module.ts` — ese cableado cruza
 * fuera de esta carpeta y queda para el paso de integración/PR review (mismo
 * criterio documentado en `incidencias-aula/module.manifest.ts`).
 */
export const reservaSalasManifest: ModuleManifest = {
  id: 'reserva-salas',
  name: 'Reserva de Salas',
  description: 'Reserva de salas de reunión por franja horaria, sustituye la hoja compartida',
  basePath: '/reserva-salas',
  requiredRoles: ['empleado', 'recepcion'],
  nav: [
    {
      label: 'Reserva de Salas',
      path: '/reserva-salas',
      requiredRoles: ['empleado', 'recepcion'],
      icon: 'DoorOpen'
    }
  ]
};
