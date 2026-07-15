import type { ModuleManifest } from '@awk/types';

/**
 * Control plane de la Fábrica (D-030, paso 2 de D-026): seguimiento y
 * aprobación de proyectos del pipeline (apps/factory, D-029). Solo admin en
 * esta fase (un operador, Leonardo) — el filtrado del shell nunca es el único
 * control: la API de apps/factory vuelve a exigir rol admin en su guard
 * (FactoryAuthGuard) validando el mismo JWT de plataforma.
 */
export const factoryConsoleManifest: ModuleManifest = {
  id: 'factory-console',
  name: 'Fábrica',
  description: 'Seguimiento y aprobación de proyectos del pipeline prototipo → módulo',
  basePath: '/factory',
  requiredRoles: ['admin'],
  nav: [{ label: 'Fábrica', path: '/factory', icon: 'Factory' }]
};
