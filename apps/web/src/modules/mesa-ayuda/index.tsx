import type { ModuleRegistration } from '../types';
import { mesaAyudaManifest } from './module.manifest';
import { LoginPage } from './LoginPage';
import { ChangePasswordPage } from './ChangePasswordPage';
import { NewTicketPage } from './NewTicketPage';
import { DashboardPage } from './DashboardPage';
import { TicketListPage } from './TicketListPage';
import { TicketDetailPage } from './TicketDetailPage';
import { AdminPage } from './AdminPage';

/**
 * Registro del módulo `mesa-ayuda`: rutas públicas (login, cambiar contraseña,
 * crear/ver ticket) y rutas autenticadas (panel de agente, admin, mis tickets externos).
 *
 * change-2: agrupa en moduleRegistration.publicRoutes las rutas que no requieren auth.
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

  // Rutas públicas (sin login requerido, accesibles sin autenticación)
  publicRoutes: [
    {
      path: '/mesa-ayuda/login',
      element: <LoginPage />
    },
    {
      path: '/mesa-ayuda/change-password',
      element: <ChangePasswordPage />
    },
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
