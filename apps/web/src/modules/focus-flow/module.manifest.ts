import type { ModuleManifest } from '@awk/types';

/**
 * Temporizador Pomodoro personal (spec-tecnica.md `focus-flow`): primer
 * módulo de datos estrictamente personales de la plataforma — sin vista de
 * equipo ni de admin (gate funcional, decisión 1). Sin `requiredRoles` a
 * nivel de módulo ni de ítem de nav: visible para cualquier autenticado,
 * `user`/`admin` tal cual (D-011) — cada quien ve solo su propia cola y
 * estadísticas, controlado en la API (nunca por rol), no por el shell.
 *
 * NOTA (docs/04, paso 4 — "Solo puede tocar las carpetas de su módulo"): este
 * manifest todavía no está registrado en `apps/web/src/modules/registry.ts`
 * ni el módulo de Nest en `apps/api/src/app.module.ts` — ese cableado cruza
 * fuera de esta carpeta y queda para el paso de integración/PR review.
 */
export const focusFlowManifest: ModuleManifest = {
  id: 'focus-flow',
  name: 'FocusFlow',
  description: 'Temporizador Pomodoro personal con cola de tareas del día y estadísticas reales',
  basePath: '/focus-flow',
  nav: [
    { label: 'Enfoque', path: '/focus-flow', icon: 'Timer' },
    { label: 'Tareas del día', path: '/focus-flow/tasks', icon: 'ListTodo' },
    { label: 'Dashboard', path: '/focus-flow/dashboard', icon: 'LayoutDashboard' },
    { label: 'Desempeño', path: '/focus-flow/performance', icon: 'TrendingUp' },
    { label: 'Configuración', path: '/focus-flow/settings', icon: 'Settings' }
  ]
};
