import type { ModuleRegistration } from '../types';
import { AulasAdminPage } from './AulasAdminPage';
import { CoordinacionPage } from './CoordinacionPage';
import { DireccionPage } from './DireccionPage';
import { DocentePage } from './DocentePage';
import { incidenciasAulaManifest } from './module.manifest';

export const incidenciasAulaModule: ModuleRegistration = {
  manifest: incidenciasAulaManifest,
  routes: [
    { path: '/incidencias-aula', element: <DocentePage /> },
    { path: '/incidencias-aula/bandeja', element: <CoordinacionPage /> },
    { path: '/incidencias-aula/resumen', element: <DireccionPage /> },
    { path: '/incidencias-aula/aulas', element: <AulasAdminPage /> }
  ]
};
