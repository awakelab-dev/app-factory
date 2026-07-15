import type { ModuleManifest } from '@awk/types';

/**
 * Primer caso real de Fase 1 (D-024/D-025/D-026): flujo público de
 * orientación de carrera para Grupo Aspasia/Refactika. El manifest solo
 * describe el panel admin (roles `orientador_admin` u `admin`, D-011) — la
 * landing del candidato es una ruta PÚBLICA (D-027) declarada en
 * `publicRoutes` de `index.tsx`, no en `nav`, para que nunca aparezca en el
 * menú del shell ni requiera sesión.
 *
 * `admin` se agrega junto a `orientador_admin` (2026-07-15, tras el primer
 * despliegue real) para que cualquier admin de plataforma vea el panel sin
 * necesitar un INSERT manual de rol en la base — los admins de Aspasia siguen
 * entrando solo con `orientador_admin`, sin ver el resto de la plataforma.
 * Los endpoints de `apps/api/.../orientador-ia.controller.ts` aceptan los
 * mismos dos roles (`@Roles('orientador_admin', 'admin')`) para que el
 * filtrado del shell y el RBAC real de la API queden consistentes.
 */
export const orientadorIaManifest: ModuleManifest = {
  id: 'orientador-ia',
  name: 'Orientador IA',
  description: 'Leads y academias del flujo de orientación de carrera (Grupo Aspasia/Refactika)',
  basePath: '/orientador-ia/admin',
  requiredRoles: ['orientador_admin', 'admin'],
  nav: [
    {
      label: 'Orientador IA',
      path: '/orientador-ia/admin',
      requiredRoles: ['orientador_admin', 'admin'],
      icon: 'Compass'
    }
  ]
};
