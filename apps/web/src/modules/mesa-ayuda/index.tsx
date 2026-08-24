import type { ModuleRegistration } from '../types';
import { mesaAyudaManifest } from './module.manifest';
import { NewTicketPage } from './NewTicketPage';
import { DashboardPage } from './DashboardPage';
import { TicketListPage } from './TicketListPage';
import { TicketDetailPage } from './TicketDetailPage';
import { AdminPage } from './AdminPage';

/**
 * Registro del módulo `mesa-ayuda`: rutas públicas (crear/ver ticket)
 * y rutas autenticadas (panel de agente, admin).
 */
export const mesaAyuda: ModuleRegistration = {
  manifest: mesaAyudaManifest,

  // Rutas autenticadas (requieren login + roles filtrados por manifest)
  routes: [
    {
      path: '/mesa-ayuda/panel',
      element: <DashboardPage />
    },
    {
      path: '/mesa-ayuda/tickets',
      element: <TicketListPage />
    },
    {
      path: '/mesa-ayuda/tickets/:id',
      element: <TicketDetailPage />
    },
    {
      path: '/mesa-ayuda/admin',
      element: <AdminPage />
    }
  ],

  // Rutas públicas (sin login requerido)
  publicRoutes: [
    {
      path: '/mesa-ayuda/nuevo',
      element: <NewTicketPage />
    },
    {
      path: '/mesa-ayuda/tickets/:id',
      element: <TicketDetailPage />
    }
  ]
};
