import { DndContext } from '@dnd-kit/core';
import type { ModuleRegistration } from '../types';
import { DashboardPage } from './DashboardPage';
import { WeekPage } from './WeekPage';
import { DelegationsPage } from './DelegationsPage';
import { MetricsPage } from './MetricsPage';
import { TeamPage } from './TeamPage';
import { PanelLayout } from './components';
import { panelPrioridadesManifest } from './module.manifest';

export const panelPrioridadesModule: ModuleRegistration = {
  manifest: panelPrioridadesManifest,
  routes: [
    { path: '/panel-prioridades', element: <PanelLayout><DndContext><DashboardPage /></DndContext></PanelLayout> },
    { path: '/panel-prioridades/week', element: <PanelLayout><DndContext><WeekPage /></DndContext></PanelLayout> },
    { path: '/panel-prioridades/delegations', element: <PanelLayout><DelegationsPage /></PanelLayout> },
    { path: '/panel-prioridades/metrics', element: <PanelLayout><MetricsPage /></PanelLayout> },
    { path: '/panel-prioridades/team', element: <PanelLayout><TeamPage /></PanelLayout> }
  ]
};
