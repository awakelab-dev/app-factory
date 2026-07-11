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
}
