import { lazy } from 'react';
import type { ModuleRegistration } from '@/lib/module-registry';
import { panelPrioridadesManifest } from './module.manifest';

/**
 * Importes lazy de las páginas del módulo.
 */
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const WeekPage = lazy(() => import('./pages/WeekPage'));
const DelegationsPage = lazy(() => import('./pages/DelegationsPage'));
const MetricsPage = lazy(() => import('./pages/MetricsPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));

/**
 * Registro del módulo Panel de Prioridades.
 *
 * El shell web descubre este módulo leyendo el archivo `index.tsx`
 * de cada carpeta en `apps/web/src/modules/` y extrae la exportación
 * `panelPrioridadesModuleRegistration` (no toca app.module.ts ni registry.ts,
 * D-050: descubrimiento automático por carpeta).
 *
 * Rutas:
 * - /panel-prioridades → DashboardPage (matriz)
 * - /panel-prioridades/week → WeekPage (bloques semanales)
 * - /panel-prioridades/delegations → DelegationsPage (delegadas)
 * - /panel-prioridades/metrics → MetricsPage (indicadores + diagnósticos)
 * - /panel-prioridades/team → TeamPage (gestión del equipo)
 */
export const panelPrioridadesModuleRegistration: ModuleRegistration = {
  manifest: panelPrioridadesManifest,
  routes: [
    {
      path: '/',
      component: DashboardPage,
      label: 'Matriz de Prioridades'
    },
    {
      path: '/week',
      component: WeekPage,
      label: 'Semana (Time-blocking)'
    },
    {
      path: '/delegations',
      component: DelegationsPage,
      label: 'Delegaciones'
    },
    {
      path: '/metrics',
      component: MetricsPage,
      label: 'Indicadores'
    },
    {
      path: '/team',
      component: TeamPage,
      label: 'Equipo'
    }
  ],
  publicRoutes: []
};
