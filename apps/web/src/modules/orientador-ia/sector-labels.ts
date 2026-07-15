import { ORIENTADOR_SECTORS } from '@awk/types';
import type { OrientadorLevel, OrientadorSector } from '@awk/types';

/**
 * Etiquetas en español para presentación (candidato y panel admin). Los 13
 * sectores en sí (`ORIENTADOR_SECTORS`, @awk/types) son contenido aprobado
 * tal cual (D-025) — estas etiquetas son solo la forma de mostrarlos, no
 * cambian el enum ni el contrato con el backend. Texto y emojis ajustados
 * 2026-07-15 (D-028) para calzar literalmente con los chips de sector del
 * prototipo original (capturas de Leonardo).
 */
export const SECTOR_LABELS: Record<OrientadorSector, string> = {
  marketing: 'Marketing',
  desarrollo: 'Desarrollo Web & Software',
  ventas: 'Ventas & Negocio',
  logistica: 'Logística',
  gestion: 'Administración & Gestión',
  operaciones: 'Operaciones',
  rrhh: 'Recursos Humanos',
  factoria: 'Factoría de Software',
  innovacion: 'Innovación',
  finanzas: 'Finanzas',
  sostenibilidad: 'Sostenibilidad · RSC · Economía Circular',
  tecnologia: 'Tecnología · IT',
  proyectos: 'Gestión de Proyectos'
};

/** Emoji por sector — mismo set que las chips del prototipo original. */
export const SECTOR_ICONS: Record<OrientadorSector, string> = {
  marketing: '📣',
  desarrollo: '💻',
  ventas: '💼',
  logistica: '📦',
  gestion: '📊',
  operaciones: '⚙️',
  rrhh: '👥',
  factoria: '🏭',
  innovacion: '💡',
  finanzas: '💰',
  sostenibilidad: '🌱',
  tecnologia: '🖥️',
  proyectos: '📋'
};

export const SECTOR_OPTIONS: OrientadorSector[] = [...ORIENTADOR_SECTORS];

export const LEVEL_LABELS: Record<OrientadorLevel, string> = {
  inicial: 'Nivel inicial',
  aplicada: 'Nivel aplicado',
  experto: 'Nivel experto'
};

export const LEVEL_OPTIONS: OrientadorLevel[] = ['inicial', 'aplicada', 'experto'];

/** Las 3 tarjetas de "¿Dónde estás hoy con la IA?" del paso 2 (prototipo original). */
export const LEVEL_CARDS: Array<{ level: OrientadorLevel; icon: string; title: string; description: string }> = [
  { level: 'inicial', icon: '🌱', title: 'Empiezo con IA', description: 'Quiero saber por dónde arrancar.' },
  {
    level: 'aplicada',
    icon: '⚡',
    title: 'Uso IA en mi día a día',
    description: 'Conozco las herramientas pero quiero profundizar.'
  },
  {
    level: 'experto',
    icon: '🚀',
    title: 'Lidero proyectos con IA',
    description: 'Quiero especializarme o liderar transformación.'
  }
];
