import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrientadorAcademy, OrientadorIntakeResponse } from '@awk/types';
import { App } from '../../App';

const academiesFixture: OrientadorAcademy[] = [
  {
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
  }
];

const intakeResponseFixture: OrientadorIntakeResponse = {
  leadId: 'lead-1',
  profile: {
    leadId: 'lead-1',
    recommendedSector: 'desarrollo',
    rationale: 'Tu experiencia describiendo proyectos técnicos encaja con desarrollo web.',
    estimatedLevel: 'aplicada',
    skillGaps: ['Testing automatizado', 'Arquitectura de agentes IA'],
    createdAt: new Date('2026-07-15T10:00:00Z').toISOString()
  }
};

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi(intakeResponse: () => Promise<unknown> = () => ok(intakeResponseFixture)) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/orientador-ia/academies')) return ok(academiesFixture);
      if (url.endsWith('/api/orientador-ia/intake') && method === 'POST') return intakeResponse();
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    })
  );
}

beforeEach(() => {
  window.history.replaceState({}, '', '/orientador-ia');
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function goThroughWizard() {
  render(<App />);
  fireEvent.click(await screen.findByTestId('start-button'));

  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ada Candidata' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
  fireEvent.click(screen.getByTestId('consent-checkbox'));
  fireEvent.click(screen.getByTestId('consent-submit'));

  // Paso 1: meta (chat) + selección de sectores.
  fireEvent.change(await screen.findByTestId('meta-input'), {
    target: { value: 'Quiero especializarme en IA aplicada al desarrollo de software.' }
  });
  fireEvent.click(screen.getByTestId('meta-submit'));
  fireEvent.click(await screen.findByTestId('sector-chip-desarrollo'));
  fireEvent.click(screen.getByTestId('sectors-continue'));

  // Paso 2: historia + nivel + envío.
  fireEvent.change(await screen.findByTestId('story-textarea'), {
    target: { value: 'Llevo 3 años programando en JS y quiero especializarme en IA aplicada.' }
  });
  fireEvent.click(screen.getByTestId('analyze-button'));
}

describe('OrientadorCandidatePage (flujo público del candidato, D-025/D-027)', () => {
  it('landing → consentimiento → meta+sectores → historia → resultado con academia recomendada', async () => {
    mockApi();
    await goThroughWizard();

    // "Desarrollo Web & Software" también aparece como chip de sector en el
    // paso 1 — se usa un testid dedicado para no depender de un texto
    // ambiguo que existe en dos pasos del wizard a la vez.
    expect(await screen.findByTestId('recommended-sector')).toHaveTextContent('Desarrollo Web & Software');
    expect(screen.getByText('Escuela de IA Aplicada al Desarrollo Web')).toBeInTheDocument();
    expect(screen.getByText('Testing automatizado')).toBeInTheDocument();
    expect(screen.getByTestId('download-pdf-button')).toBeInTheDocument();
  });

  it('el consentimiento es obligatorio antes de continuar', async () => {
    mockApi();
    render(<App />);
    fireEvent.click(await screen.findByTestId('start-button'));

    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ada Candidata' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    // Sin marcar el checkbox de consentimiento:
    fireEvent.click(screen.getByTestId('consent-submit'));

    expect(await screen.findByTestId('consent-error')).toHaveTextContent('consentimiento');
  });

  it('requiere elegir al menos un sector antes de continuar al paso 2', async () => {
    mockApi();
    render(<App />);
    fireEvent.click(await screen.findByTestId('start-button'));

    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ada Candidata' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.click(screen.getByTestId('consent-checkbox'));
    fireEvent.click(screen.getByTestId('consent-submit'));

    fireEvent.change(await screen.findByTestId('meta-input'), {
      target: { value: 'Quiero especializarme en IA aplicada al desarrollo de software.' }
    });
    fireEvent.click(screen.getByTestId('meta-submit'));

    expect(screen.getByTestId('sectors-continue')).toBeDisabled();
  });

  it('si se alcanza el límite de análisis (429), muestra un aviso claro sin perder el paso 2', async () => {
    mockApi(() => Promise.resolve({ ok: false, status: 429, json: () => Promise.resolve({}) }));
    await goThroughWizard();

    expect(await screen.findByTestId('input-error')).toHaveTextContent('límite de análisis');
    // El formulario sigue montado con lo que el candidato ya había escrito.
    expect(screen.getByTestId('story-textarea')).toHaveValue(
      'Llevo 3 años programando en JS y quiero especializarme en IA aplicada.'
    );
  });
});
