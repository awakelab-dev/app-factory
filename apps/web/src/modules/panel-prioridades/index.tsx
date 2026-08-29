import type { ModuleRegistration } from '../types';
import { DashboardPage } from './DashboardPage';
import { WeekPage } from './WeekPage';
import { DelegationsPage } from './DelegationsPage';
import { MetricsPage } from './MetricsPage';
import { TeamPage } from './TeamPage';
import { panelPrioridadesManifest } from './module.manifest';

export const panelPrioridadesModule: ModuleRegistration = {
  manifest: panelPrioridadesManifest,
  routes: [
    { path: '/panel-prioridades', element: <DashboardPage /> },
    { path: '/panel-prioridades/week', element: <WeekPage /> },
    { path: '/panel-prioridades/delegations', element: <DelegationsPage /> },
    { path: '/panel-prioridades/metrics', element: <MetricsPage /> },
    { path: '/panel-prioridades/team', element: <TeamPage /> }
  ]
};
