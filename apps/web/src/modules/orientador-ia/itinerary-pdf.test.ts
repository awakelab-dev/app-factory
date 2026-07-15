import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as JsPdfModule from 'jspdf';
import type { OrientadorAcademy, OrientadorProfile } from '@awk/types';

// jsPDF detecta que corre en Node (no un navegador real) y `save()` cae a
// escribir el PDF a disco vía `fs` en vez de disparar una descarga — sin
// este mock, cada corrida de este test deja un `itinerario-*.pdf` real en
// el working directory. `save` se asigna como propiedad de INSTANCIA dentro
// del propio constructor de jsPDF (su sistema de plugins hace `this.save =
// API.save`), así que sombrea cualquier método de la misma clase declarado
// en una subclase — hay que reasignarla después de `super(...)`, no antes.
const saveSpy = vi.fn();
vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof JsPdfModule>();
  class TestJsPDF extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      this.save = ((filename?: string) => {
        saveSpy(filename);
        return this;
      }) as unknown as typeof this.save;
    }
  }
  return { ...actual, jsPDF: TestJsPDF };
});

const { downloadItineraryPdf } = await import('./itinerary-pdf');

const profileFixture: OrientadorProfile = {
  leadId: 'lead-1',
  recommendedSector: 'desarrollo',
  rationale: 'Tu experiencia describiendo proyectos técnicos encaja con desarrollo web.',
  estimatedLevel: 'aplicada',
  skillGaps: ['Testing automatizado', 'Arquitectura de agentes IA'],
  createdAt: new Date('2026-07-15T10:00:00Z').toISOString()
};

const academyFixture: OrientadorAcademy = {
  id: 'ia-desarrollo',
  sector: 'desarrollo',
  name: 'Escuela de IA Aplicada al Desarrollo Web',
  shortName: 'IA · Desarrollo',
  icon: '💻',
  color: '#FF6A00',
  duration: '6 meses',
  durationWeeks: 26,
  synchronous: 'Pair programming 2 veces/semana',
  asynchronous: 'Labs con feedback IA + code reviews',
  challenge: 'Construye un agente IA funcional con RAG, evals y despliegue productivo.',
  modules: ['AI-assisted coding', 'Arquitectura de agentes IA'],
  outcomes: ['Triplicar tu velocidad de desarrollo'],
  priceEur: '1.890 €',
  priceUsd: '2.090 USD',
  purchaseUrl: 'https://refactika.com/ia-desarrollo',
  active: true
};

afterEach(() => {
  saveSpy.mockClear();
});

describe('downloadItineraryPdf (rediseño Refactika, D-028)', () => {
  it('genera las 3 páginas (portada, troncal, cierre) sin lanzar con una academia recomendada', () => {
    expect(() => downloadItineraryPdf('Ada Candidata', profileFixture, academyFixture)).not.toThrow();
    expect(saveSpy).toHaveBeenCalledWith('itinerario-orientadoria-lead-1.pdf');
  });

  it('también genera el PDF cuando no hay academia recomendada (sector sin escuela cargada)', () => {
    expect(() => downloadItineraryPdf('Ada Candidata', profileFixture, null)).not.toThrow();
  });

  it('funciona sin huecos de formación detectados', () => {
    const noGaps: OrientadorProfile = { ...profileFixture, skillGaps: [] };
    expect(() => downloadItineraryPdf('Ada Candidata', noGaps, academyFixture)).not.toThrow();
  });
});
