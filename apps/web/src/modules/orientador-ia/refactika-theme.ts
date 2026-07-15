/**
 * Identidad visual del frontend PÚBLICO de orientador-ia: marca **Refactika**
 * (D-028, reversión deliberada de la decisión original de rebranding a
 * Awakelab, gate funcional 2026-07-14 punto 2) — el candidato es cliente de
 * Grupo Aspasia/Refactika, no de Awakelab, así que esta pantalla nunca debe
 * verse como parte de la plataforma AwkPlatform. El panel admin (D-011, dentro
 * del shell) SÍ sigue con la identidad Awakelab 2026 — este archivo no lo toca.
 *
 * Colores tomados de las capturas del prototipo original + `color: '#FF6A00'`
 * ya presente en el contenido real de las 13 academias
 * (`apps/api/prisma/seed-data/orientador-academies.ts`) — mismo acento en
 * datos y en UI. Se usan tanto en clases Tailwind (arbitrary values) como en
 * `itinerary-pdf.ts` (jsPDF no lee CSS) para que ambos queden idénticos.
 */
export const REFACTIKA_COLORS = {
  orange: '#FF6A00',
  orangeDark: '#C24E00',
  navy: '#0B1220',
  navySoft: '#111827',
  cream: '#FAF9F6',
  border: '#E7E4DD',
  muted: '#6B7280'
} as const;

/** Fuente exclusiva de este módulo (Manrope, ver index.html) — nunca Poppins aquí. */
export const REFACTIKA_FONT = "'Manrope', ui-sans-serif, system-ui, sans-serif";

/**
 * Custom properties CSS para spread en el elemento raíz de cada página
 * pública de orientador-ia. Las clases Tailwind de los componentes hijos
 * referencian estos nombres literalmente (p. ej. `text-[var(--rf-navy)]`) —
 * Tailwind los detecta en tiempo de build porque el string es literal en el
 * código fuente; el valor real lo resuelve el navegador vía herencia CSS
 * normal, así que solo hace falta definirlos una vez en la raíz.
 */
export const REFACTIKA_CSS_VARS: Record<string, string> = {
  '--rf-orange': REFACTIKA_COLORS.orange,
  '--rf-orange-dark': REFACTIKA_COLORS.orangeDark,
  '--rf-navy': REFACTIKA_COLORS.navy,
  '--rf-navy-soft': REFACTIKA_COLORS.navySoft,
  '--rf-cream': REFACTIKA_COLORS.cream,
  '--rf-border': REFACTIKA_COLORS.border,
  '--rf-muted': REFACTIKA_COLORS.muted,
  fontFamily: REFACTIKA_FONT
};
