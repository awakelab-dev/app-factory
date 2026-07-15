import type { ReactElement } from 'react';
import type { ModuleManifest } from '@awk/types';

/**
 * Registro de un módulo en el shell: el manifest (data pura, compartida con
 * la API en el futuro) + el mapeo ruta→componente que solo existe en web.
 * Cada módulo generado por la fábrica exporta un ModuleRegistration.
 */
export interface ModuleRoute {
  /** Ruta absoluta (coincide con las paths declaradas en el manifest). */
  path: string;
  element: ReactElement;
}

export interface ModuleRegistration {
  manifest: ModuleManifest;
  routes: ModuleRoute[];
  /**
   * Rutas PÚBLICAS del módulo (sin login) — p.ej. la landing de candidato de
   * orientador-ia (D-027). Se renderizan siempre, independientemente del
   * estado de auth y sin el <Layout> del shell (sin sidebar): son la única
   * superficie de la plataforma pensada para visitantes sin cuenta. La
   * mayoría de los módulos no declara ninguna — el shell sigue asumiendo
   * "todo detrás de login" (D-011) salvo que un módulo pida explícitamente
   * lo contrario aquí.
   */
  publicRoutes?: ModuleRoute[];
}
