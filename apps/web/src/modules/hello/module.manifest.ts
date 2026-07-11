import type { ModuleManifest } from '@awk/types';

/**
 * Manifest del módulo demo. Este archivo es el EJEMPLO del contrato que cada
 * módulo (hecho a mano o generado por la fábrica) declara para que el shell
 * construya menú y rutas. Sin requiredRoles: visible para todo autenticado.
 */
export const helloManifest: ModuleManifest = {
  id: 'hello',
  name: 'Demo Hello',
  description: 'Verificación end-to-end del contrato tipado api↔web (Fase 0)',
  basePath: '/hello',
  nav: [{ label: 'Demo Hello', path: '/hello' }]
};
