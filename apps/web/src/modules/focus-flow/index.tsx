import type { ModuleRegistration } from '../types';
import { DashboardPage } from './DashboardPage';
import { FocusPage } from './FocusPage';
import { focusFlowManifest } from './module.manifest';
import { PerformancePage } from './PerformancePage';
import { SettingsPage } from './SettingsPage';
import { TasksPage } from './TasksPage';

export const focusFlowModule: ModuleRegistration = {
  manifest: focusFlowManifest,
  routes: [
    { path: '/focus-flow', element: <FocusPage /> },
    { path: '/focus-flow/tasks', element: <TasksPage /> },
    { path: '/focus-flow/dashboard', element: <DashboardPage /> },
    { path: '/focus-flow/performance', element: <PerformancePage /> },
    { path: '/focus-flow/settings', element: <SettingsPage /> }
  ]
};
