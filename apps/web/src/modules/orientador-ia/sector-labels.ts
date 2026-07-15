import { ORIENTADOR_SECTORS } from '@awk/types';
import type { OrientadorLevel, OrientadorSector } from '@awk/types';

/**
 * Etiquetas en español para presentación (candidato y panel admin). Los 13
 * sectores en sí (`ORIENTADOR_SECTORS`, @awk/types) son contenido aprobado
 * tal cual (D-025) — estas etiquetas son solo la forma de mostrarlos, no
 * cambian el enum ni el contrato con el backend.
 */
export const SECTOR_LABELS: Record<OrientadorSector, string> = {
  marketing: 'Marketing',
  desarrollo: 'Desarrollo web',
  ventas: 'Ventas',
  logistica: 'Logística',
  gestion: 'Administración y gestión',
  operaciones: 'Operaciones',
  rrhh: 'RRHH',
  factoria: 'Factoría de software',
  innovacion: 'Innovación',
  finanzas: 'Finanzas',
  sostenibilidad: 'Sostenibilidad, RSC y economía circular',
  tecnologia: 'Tecnología (IT)',
  proyectos: 'Gestión de proyectos'
};

export const SECTOR_OPTIONS: OrientadorSector[] = [...ORIENTADOR_SECTORS];

export const LEVEL_LABELS: Record<OrientadorLevel, string> = {
  inicial: 'Nivel inicial',
  aplicada: 'Nivel aplicado',
  experto: 'Nivel experto'
};

export const LEVEL_OPTIONS: OrientadorLevel[] = ['inicial', 'aplicada', 'experto'];
