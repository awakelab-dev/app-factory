import type { ModuleRegistration } from '../types';
import { FactoryProjectDetailPage } from './FactoryProjectDetailPage';
import { FactoryProjectsPage } from './FactoryProjectsPage';
import { factoryConsoleManifest } from './module.manifest';

export const factoryConsoleModule: ModuleRegistration = {
  manifest: factoryConsoleManifest,
  routes: [
    { path: '/factory', element: <FactoryProjectsPage /> },
    { path: '/factory/:projectId', element: <FactoryProjectDetailPage /> }
  ]
};
