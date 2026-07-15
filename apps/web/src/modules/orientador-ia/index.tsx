import type { ModuleRegistration } from '../types';
import { MarketIntelPage } from './MarketIntelPage';
import { OrientadorAdminPage } from './OrientadorAdminPage';
import { OrientadorCandidatePage } from './OrientadorCandidatePage';
import { orientadorIaManifest } from './module.manifest';

export const orientadorIaModule: ModuleRegistration = {
  manifest: orientadorIaManifest,
  routes: [{ path: '/orientador-ia/admin', element: <OrientadorAdminPage /> }],
  // Rutas públicas (D-027): landing + wizard del candidato y la sección libre
  // de "Inteligencia de mercado" (D-028), ambas sin login.
  publicRoutes: [
    { path: '/orientador-ia', element: <OrientadorCandidatePage /> },
    { path: '/orientador-ia/mercado', element: <MarketIntelPage /> }
  ]
};
