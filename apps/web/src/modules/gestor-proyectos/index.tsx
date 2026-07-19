import type { ModuleRegistration } from '../types';
import { DashboardPage } from './DashboardPage';
import { gestorProyectosManifest } from './module.manifest';
import { ProjectDetailPage } from './ProjectDetailPage';
import { ProjectsPage } from './ProjectsPage';
import { ReportsPage } from './ReportsPage';

export const gestorProyectosModule: ModuleRegistration = {
  manifest: gestorProyectosManifest,
  routes: [
    { path: '/gestor-proyectos', element: <DashboardPage /> },
    { path: '/gestor-proyectos/projects', element: <ProjectsPage /> },
    { path: '/gestor-proyectos/projects/:projectId', element: <ProjectDetailPage /> },
    { path: '/gestor-proyectos/projects/:projectId/reports', element: <ReportsPage /> }
  ]
};
