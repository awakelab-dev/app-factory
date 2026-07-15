import type { ModuleManifest } from '@awk/types';

/**
 * Primer caso real de Fase 1 (D-024/D-025/D-026): flujo público de
 * orientación de carrera para Grupo Aspasia/Refactika. El manifest solo
 * describe el panel admin (rol acotado `orientador_admin`, D-011) — la
 * landing del candidato es una ruta PÚBLICA (D-027) declarada en
 * `publicRoutes` de `index.tsx`, no en `nav`, para que nunca aparezca en el
 * menú del shell ni requiera sesión.
 */
export const orientadorIaManifest: ModuleManifest = {
  id: 'orientador-ia',
  name: 'Orientador IA',
  description: 'Leads y academias del flujo de orientación de carrera (Grupo Aspasia/Refactika)',
  basePath: '/orientador-ia/admin',
  requiredRoles: ['orientador_admin'],
  nav: [
    {
      label: 'Orientador IA',
      path: '/orientador-ia/admin',
      requiredRoles: ['orientador_admin'],
      icon: 'Compass'
    }
  ]
};
