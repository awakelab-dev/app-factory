import type { ModuleRegistration } from '../types';
import { coreAdminManifest } from './module.manifest';
import { UsersPage } from './UsersPage';

export const coreAdminModule: ModuleRegistration = {
  manifest: coreAdminManifest,
  routes: [{ path: '/admin/usuarios', element: <UsersPage /> }]
};
