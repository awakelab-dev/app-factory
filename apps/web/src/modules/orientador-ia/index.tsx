import type { ModuleRegistration } from '../types';
import { OrientadorAdminPage } from './OrientadorAdminPage';
import { OrientadorCandidatePage } from './OrientadorCandidatePage';
import { orientadorIaManifest } from './module.manifest';

export const orientadorIaModule: ModuleRegistration = {
  manifest: orientadorIaManifest,
  routes: [{ path: '/orientador-ia/admin', element: <OrientadorAdminPage /> }],
  // Ruta pública (D-027): landing + wizard del candidato, sin login.
  publicRoutes: [{ path: '/orientador-ia', element: <OrientadorCandidatePage /> }]
};
