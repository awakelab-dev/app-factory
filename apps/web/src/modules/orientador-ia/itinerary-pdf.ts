import { jsPDF } from 'jspdf';
import type { OrientadorAcademy, OrientadorProfile } from '@awk/types';
import { REFACTIKA_COLORS } from './refactika-theme';
import { LEVEL_LABELS, SECTOR_LABELS } from './sector-labels';

/**
 * PDF del itinerario recomendado — client-side (spec técnica original,
 * "PDF del itinerario": se mantiene jsPDF en el navegador, sin mover esta
 * generación al backend porque no añade ningún dato sensible que el
 * candidato no vea ya en pantalla).
 *
 * Rediseño 2026-07-15 (D-028): el PDF original (Awakelab, texto plano) se
 * sentía muy por debajo del PDF de referencia del prototipo Refactika
 * (`Itinerario_IA___Desarrollo.pdf`, adjuntado por Leonardo) — portada con
 * KPIs, franja oscura de cita, troncal común de 120h y cierre con 3 CTAs.
 * Esta versión reproduce esa estructura con jsPDF (rects + texto, sin
 * plantillas externas) y la paleta Refactika (`refactika-theme.ts`), no la
 * de Awakelab — este PDF es un entregable para el candidato, no para la
 * plataforma.
 */
const { orange, navy, muted } = REFACTIKA_COLORS;
const PAGE_W = 210;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Troncal común de 120h presente en toda Aceleradora IA (contenido del prototipo original, D-025). */
const TRONCAL_MODULES = [
  { name: 'IA aplicada a procesos · Desarrollo agéntico', desc: 'Construye y orquesta agentes IA que trabajan por ti.' },
  { name: 'Flujos automatizables', desc: 'Identifica qué automatizar, con qué herramienta y cómo medir el ahorro.' },
  { name: 'Suite de trabajo con IA', desc: 'Notion, Slack, Google, Microsoft, ClickUp: todo potenciado con IA.' },
  { name: 'Herramientas IA esenciales', desc: 'El kit mínimo que cualquier profesional debe dominar en 2026.' },
  { name: 'La IA como potenciador de tus habilidades', desc: 'Usa la IA para amplificar lo que ya haces, sin reemplazarte.' }
];
const TRONCAL_HOURS = 120;

export function downloadItineraryPdf(fullName: string, profile: OrientadorProfile, academy: OrientadorAcademy | null): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const sectorLabel = SECTOR_LABELS[profile.recommendedSector];
  const dateLabel = new Date(profile.createdAt).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  drawCoverPage(doc, { fullName, dateLabel, sectorLabel, profile, academy });
  doc.addPage();
  drawTroncalPage(doc, { sectorLabel, profile });
  doc.addPage();
  drawClosingPage(doc, { academy, sectorLabel });

  doc.save(`itinerario-orientadoria-${profile.leadId}.pdf`);
}

// ---------------------------------------------------------------------------
// Página 1 · Portada
// ---------------------------------------------------------------------------

function drawCoverPage(
  doc: jsPDF,
  opts: { fullName: string; dateLabel: string; sectorLabel: string; profile: OrientadorProfile; academy: OrientadorAcademy | null }
) {
  const { fullName, dateLabel, sectorLabel, profile, academy } = opts;

  // Franja superior oscura (marca Refactika, no Awakelab).
  doc.setFillColor(navy);
  doc.rect(0, 0, PAGE_W, 78, 'F');

  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ORIENTADOR', MARGIN, 16);
  doc.setTextColor(orange);
  doc.text('IA', MARGIN + 22, 16);
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('by REFACTIKA', MARGIN, 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('Tu itinerario', MARGIN, 40);
  doc.setTextColor(orange);
  doc.text('con IA aplicada.', MARGIN, 50);

  // Tarjeta "preparado para" (blanca, esquina superior derecha).
  doc.setFillColor('#FFFFFF');
  doc.roundedRect(128, 10, 64, 24, 3, 3, 'F');
  doc.setTextColor(muted);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('PREPARADO PARA', 132, 17);
  doc.setTextColor(navy);
  doc.setFontSize(11);
  doc.text(truncate(fullName, 28), 132, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(dateLabel, 132, 30);

  // 4 KPIs (duración / habilidades / sincrónico / inversión).
  const kpis = [
    { label: 'Duración', value: academy?.duration ?? '4-6 meses' },
    { label: 'Habilidades', value: `${profile.skillGaps.length || academy?.modules.length || 3}` },
    { label: 'Sincrónico', value: academy ? shortenSync(academy.synchronous) : 'Gimnasio en vivo' },
    { label: 'Inversión', value: academy?.priceEur ?? 'A consultar' }
  ];
  const kpiW = (CONTENT_W - 3 * 4) / 4;
  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (kpiW + 4);
    doc.setFillColor('#111827'); // navySoft
    doc.roundedRect(x, 60, kpiW, 14, 2, 2, 'F');
    doc.setTextColor(orange);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(kpi.label.toUpperCase(), x + 3, 65);
    doc.setTextColor('#FFFFFF');
    doc.setFontSize(9.5);
    doc.text(truncate(kpi.value, 22), x + 3, 71);
  });

  // Cuerpo blanco: sector recomendado + por qué.
  let y = 92;
  doc.setTextColor(orange);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SECTOR RECOMENDADO', MARGIN, y);
  y += 7;
  doc.setTextColor(navy);
  doc.setFontSize(16);
  doc.text(academy?.name ?? sectorLabel, MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(muted);
  doc.text(`Nivel estimado: ${LEVEL_LABELS[profile.estimatedLevel]} · ${sectorLabel}`, MARGIN, y);

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(navy);
  doc.text('Por qué este sector', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(muted);
  y = writeWrapped(doc, profile.rationale, MARGIN, y, CONTENT_W, 5);

  // Franja de cita (oscura, como el original).
  const quoteY = 235;
  doc.setFillColor(navy);
  doc.roundedRect(MARGIN, quoteY, CONTENT_W, 32, 3, 3, 'F');
  doc.setTextColor(orange);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('“Si no te formas en IA,', MARGIN + 6, quoteY + 13);
  doc.text('alguien te reemplazará.”', MARGIN + 6, quoteY + 22);
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('OrientadorIA by Refactika · datos reales de mercado', MARGIN + 6, quoteY + 28);
}

// ---------------------------------------------------------------------------
// Página 2 · Troncal común + huecos de formación
// ---------------------------------------------------------------------------

function drawTroncalPage(doc: jsPDF, opts: { sectorLabel: string; profile: OrientadorProfile }) {
  const { sectorLabel, profile } = opts;
  let y = 22;

  pageHeader(doc, 'METODOLOGÍA');
  doc.setTextColor(navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('El troncal común', MARGIN, y);

  doc.setFillColor(orange);
  doc.roundedRect(148, y - 6, 44, 8, 2, 2, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`${TRONCAL_HOURS}h TOTALES`, 152, y - 0.5);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(muted);
  y = writeWrapped(
    doc,
    'Plan común a toda Aceleradora IA de Refactika: 5 bloques transversales de 24h cada uno, con acceso al gimnasio de sesiones sincrónicas desde la primera semana.',
    MARGIN,
    y + 4,
    CONTENT_W,
    5
  );

  y += 8;
  TRONCAL_MODULES.forEach((mod, i) => {
    doc.setFillColor(orange);
    doc.circle(MARGIN + 3, y - 1.5, 3.2, 'F');
    doc.setTextColor('#FFFFFF');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(String(i + 1), MARGIN + 1.5, y);

    doc.setTextColor(navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(mod.name, MARGIN + 9, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(muted);
    y = writeWrapped(doc, `${mod.desc} · 24h`, MARGIN + 9, y, CONTENT_W - 9, 4.6);
    y += 5;
  });

  y += 4;
  doc.setDrawColor('#E7E4DD');
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  doc.setTextColor(navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Huecos de formación detectados', MARGIN, y);
  y += 7;

  if (profile.skillGaps.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    for (const gap of profile.skillGaps) {
      doc.setFillColor(orange);
      doc.circle(MARGIN + 1.2, y - 1.4, 1.2, 'F');
      doc.setTextColor(muted);
      y = writeWrapped(doc, gap, MARGIN + 5, y, CONTENT_W - 5, 5);
      y += 3;
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(muted);
    doc.text(`Perfil ya sólido en ${sectorLabel} — el troncal común consolida lo que ya sabes.`, MARGIN, y);
  }
}

// ---------------------------------------------------------------------------
// Página 3 · Escuela recomendada + siguientes pasos
// ---------------------------------------------------------------------------

function drawClosingPage(doc: jsPDF, opts: { academy: OrientadorAcademy | null; sectorLabel: string }) {
  const { academy, sectorLabel } = opts;
  let y = 22;

  pageHeader(doc, 'TU ESCUELA');
  doc.setTextColor(navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(academy?.name ?? `Aceleradora IA · ${sectorLabel}`, MARGIN, y);

  if (academy) {
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(muted);
    doc.text(`${academy.duration} · ${academy.priceEur} / ${academy.priceUsd}`, MARGIN, y);

    y += 8;
    doc.setFillColor('#F0F3FC');
    doc.roundedRect(MARGIN, y, CONTENT_W, 20, 2, 2, 'F');
    doc.setTextColor(orange);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('RETO FINAL', MARGIN + 4, y + 6);
    doc.setTextColor(navy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    writeWrapped(doc, academy.challenge, MARGIN + 4, y + 11, CONTENT_W - 8, 4.4);

    y += 26;
    if (academy.modules.length > 0) {
      doc.setTextColor(navy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Qué aprenderás', MARGIN, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      for (const item of academy.modules) {
        doc.setFillColor(orange);
        doc.rect(MARGIN, y - 3, 2.4, 2.4, 'F');
        doc.setTextColor(muted);
        y = writeWrapped(doc, item, MARGIN + 5, y, CONTENT_W - 5, 4.8);
        y += 2;
      }
    }

    if (academy.outcomes.length > 0) {
      y += 4;
      doc.setTextColor(navy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Al terminar podrás', MARGIN, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      for (const item of academy.outcomes) {
        doc.setTextColor(orange);
        doc.text('✓', MARGIN, y);
        doc.setTextColor(muted);
        y = writeWrapped(doc, item, MARGIN + 5, y, CONTENT_W - 5, 4.8);
        y += 2;
      }
    }
  } else {
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(muted);
    y = writeWrapped(
      doc,
      `Aún no tenemos una escuela específica cargada para ${sectorLabel}, pero el troncal común de 120h y el gimnasio de sesiones sincrónicas ya te dan una base sólida en IA aplicada.`,
      MARGIN,
      y,
      CONTENT_W,
      5
    );
  }

  // Siguientes pasos (3 CTAs, como el original).
  const ctaY = 210;
  doc.setTextColor(navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Siguientes pasos', MARGIN, ctaY);

  const ctas = [
    { label: 'Escríbenos', value: 'admisiones@refactika.com' },
    { label: 'Comprar online', value: 'Próximamente' },
    { label: 'WhatsApp', value: '+34 900 000 000' }
  ];
  const ctaW = (CONTENT_W - 2 * 4) / 3;
  ctas.forEach((cta, i) => {
    const x = MARGIN + i * (ctaW + 4);
    doc.setDrawColor(orange);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, ctaY + 6, ctaW, 18, 2, 2, 'S');
    doc.setTextColor(orange);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(cta.label.toUpperCase(), x + 3, ctaY + 12);
    doc.setTextColor(navy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(truncate(cta.value, 26), x + 3, ctaY + 18);
  });

  // Franja de cierre (oscura, tagline final del prototipo original).
  doc.setFillColor(navy);
  doc.rect(0, 260, PAGE_W, 37, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('La IA no reemplaza profesionales.', MARGIN, 275);
  doc.setTextColor(orange);
  doc.text('Reemplaza a quienes no la usan.', MARGIN, 283);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor('#9CA3AF');
  doc.text('OrientadorIA by Refactika — Grupo Aspasia', MARGIN, 291);
}

// ---------------------------------------------------------------------------
// Utilidades de layout
// ---------------------------------------------------------------------------

function pageHeader(doc: jsPDF, eyebrow: string) {
  doc.setTextColor(orange);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(eyebrow, MARGIN, 12);
  doc.setDrawColor('#E7E4DD');
  doc.setLineWidth(0.2);
  doc.line(MARGIN, 15, PAGE_W - MARGIN, 15);
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 5.5): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function shortenSync(text: string): string {
  return truncate(text, 20);
}
