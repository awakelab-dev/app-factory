import { DndContext } from '@dnd-kit/core';
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
    { path: '/panel-prioridades', element: <DndContext><DashboardPage /></DndContext> },
    { path: '/panel-prioridades/week', element: <DndContext><WeekPage /></DndContext> },
    { path: '/panel-prioridades/delegations', element: <DelegationsPage /> },
    { path: '/panel-prioridades/metrics', element: <MetricsPage /> },
    { path: '/panel-prioridades/team', element: <TeamPage /> }
  ]
};
