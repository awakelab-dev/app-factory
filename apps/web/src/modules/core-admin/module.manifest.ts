import type { ModuleManifest } from '@awk/types';

/** Administración del core. requiredRoles a nivel módulo: solo admin lo ve. */
export const coreAdminManifest: ModuleManifest = {
  id: 'core-admin',
  name: 'Administración',
  description: 'Usuarios, roles y auditoría de la plataforma',
  basePath: '/admin',
  requiredRoles: ['admin'],
  nav: [{ label: 'Usuarios', path: '/admin/usuarios', requiredRoles: ['admin'], icon: 'ShieldCheck' }]
};
