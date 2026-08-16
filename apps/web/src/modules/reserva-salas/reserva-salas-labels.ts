import type { FranjaEstado } from './reserva-salas.types';

/** Filtro de capacidad mínima de la rejilla del calendario (spec-funcional.md,
 * flujo Empleado paso 2: "filtro de capacidad mínima (cualquiera, 4+, 8+,
 * 12+ personas)"). Único lugar donde viven estos 4 umbrales. */
export const CAPACIDAD_FILTROS = [
  { value: 0, label: 'Cualquier capacidad' },
  { value: 4, label: '4+ personas' },
  { value: 8, label: '8+ personas' },
  { value: 12, label: '12+ personas' }
] as const;

export const FRANJA_ESTADO_ACCENT: Record<FranjaEstado, string> = {
  libre: 'border-awk-blue-700 text-awk-blue-300 hover:border-awk-cyan-500 hover:text-awk-cyan-300',
  tuya: 'border-awk-cyan-500 bg-awk-cyan-950/40 text-awk-cyan-300',
  ocupada: 'border-awk-blue-800 bg-awk-navy-900 text-awk-blue-500'
};
