import type { ModuleRegistration } from '../types';
import { mesaAyudaManifest } from './module.manifest';
import { NewTicketPage } from './NewTicketPage';
import { DashboardPage } from './DashboardPage';
import { TicketListPage } from './TicketListPage';
import { TicketDetailPage } from './TicketDetailPage';
import { AdminPage } from './AdminPage';

/**
 * Registro del módulo `mesa-ayuda`. Todas las rutas van tras el login: el
 * solicitante entra con su cuenta de la plataforma, no por un enlace público.
 */
export const mesaAyuda: ModuleRegistration = {
  manifest: mesaAyudaManifest,

  // Rutas autenticadas (requieren login + roles filtrados por manifest)
  routes: [
    {
      path: '/mesa-ayuda/nuevo',
      element: <NewTicketPage />
    },
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
  ]
};
