import type { ModuleRegistration } from '../types';
import { DashboardPage } from './DashboardPage';
import { WeekPage } from './WeekPage';
import { MetricsPage } from './MetricsPage';
import { DelegationsPage } from './DelegationsPage';
import { TeamPage } from './TeamPage';
import { panelPrioritiesManifest } from './module.manifest';

/**
 * Registro del módulo panel-prioridades para el shell de la plataforma.
 * El descubrimiento automático (D-050) se encarga de incorporar estas rutas
 * y el manifest al menú de navegación.
 */
export const panelPrioritiesModule: ModuleRegistration = {
  manifest: panelPrioritiesManifest,
  routes: [
    { path: '/panel-prioridades', element: <DashboardPage /> },
    { path: '/panel-prioridades/week', element: <WeekPage /> },
    { path: '/panel-prioridades/metrics', element: <MetricsPage /> },
    { path: '/panel-prioridades/delegations', element: <DelegationsPage /> },
    { path: '/panel-prioridades/team', element: <TeamPage /> }
  ]
};
