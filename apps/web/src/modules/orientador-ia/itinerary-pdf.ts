import { jsPDF } from 'jspdf';
import type { OrientadorAcademy, OrientadorProfile } from '@awk/types';
import { LEVEL_LABELS, SECTOR_LABELS } from './sector-labels';

/**
 * PDF del itinerario recomendado — client-side (spec técnica, "PDF del
 * itinerario": se mantiene jsPDF en el navegador, sin mover esta generación
 * al backend porque no añade ningún dato sensible que el candidato no vea
 * ya en pantalla).
 */
export function downloadItineraryPdf(fullName: string, profile: OrientadorProfile, academy: OrientadorAcademy | null): void {
  const doc = new jsPDF();
  const marginX = 20;
  let y = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor('#003670');
  doc.text('Tu itinerario de orientación · Awakelab', marginX, y);

  y += 12;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#27334f');
  doc.text(`Candidato: ${fullName}`, marginX, y);
  y += 7;
  doc.text(`Fecha: ${new Date(profile.createdAt).toLocaleDateString('es-ES')}`, marginX, y);

  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor('#0b93aa');
  doc.text(`Sector recomendado: ${SECTOR_LABELS[profile.recommendedSector]}`, marginX, y);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor('#27334f');
  doc.text(`Nivel estimado: ${LEVEL_LABELS[profile.estimatedLevel]}`, marginX, y);

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Por qué este sector', marginX, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  y = writeWrapped(doc, profile.rationale, marginX, y, 170);

  if (profile.skillGaps.length > 0) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Huecos de formación identificados', marginX, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    for (const gap of profile.skillGaps) {
      y = writeWrapped(doc, `• ${gap}`, marginX, y, 170);
      y += 2;
    }
  }

  if (academy) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor('#0b93aa');
    doc.text(academy.name, marginX, y);
    y += 7;
    doc.setFontSize(11);
    doc.setTextColor('#27334f');
    doc.setFont('helvetica', 'normal');
    doc.text(`Duración: ${academy.duration}  ·  Precio: ${academy.priceEur} / ${academy.priceUsd}`, marginX, y);
    y += 7;
    y = writeWrapped(doc, `Reto final: ${academy.challenge}`, marginX, y, 170);

    if (academy.modules.length > 0) {
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.text('Módulos', marginX, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      for (const item of academy.modules) {
        y = writeWrapped(doc, `• ${item}`, marginX, y, 170);
      }
    }

    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#0abcc9');
    doc.text(`Más información: ${academy.purchaseUrl}`, marginX, y);
  }

  doc.save(`itinerario-orientador-ia-${profile.leadId}.pdf`);
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, maxWidth: number): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  doc.text(lines, x, y);
  return y + lines.length * 5.5;
}
