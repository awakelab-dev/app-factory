import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, OrientadorAcademy, OrientadorLeadRow } from '@awk/types';
import { App } from '../../App';

const orientadorAdminFixture: AuthUser = {
  id: 'u-1',
  email: 'admin@grupoaspasia.com',
  displayName: 'Admin Aspasia',
  roles: ['orientador_admin']
};

// 2026-07-15: tras el primer despliegue real, un admin de plataforma sin
// `orientador_admin` se quedó fuera del panel (redirigido a /hello) y solo
// pudo entrar tras un INSERT manual de rol en la base. Se amplió el manifest
// y el @Roles del backend para aceptar también 'admin' — este fixture cubre
// esa regresión.
const platformAdminFixture: AuthUser = {
  id: 'u-2',
  email: 'leonardo.barreto@awakelab.dev',
  displayName: 'Leonardo Barreto',
  roles: ['admin']
};

const leadsFixture: OrientadorLeadRow[] = [
  {
    id: 'lead-1',
    createdAt: new Date('2026-07-15T09:00:00Z').toISOString(),
    fullName: 'Ada Candidata',
    email: 'ada@example.com',
    phone: null,
    consentMarketing: false,
    rawInputType: 'story',
    declaredSector: null,
    analysisCount: 1,
    profile: {
      leadId: 'lead-1',
      recommendedSector: 'desarrollo',
      rationale: 'Encaja con desarrollo web.',
      estimatedLevel: 'aplicada',
      skillGaps: ['Testing'],
      createdAt: new Date('2026-07-15T09:00:05Z').toISOString()
    }
  }
];

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
    modules: ['AI-assisted coding'],
    outcomes: ['Triplicar tu velocidad de desarrollo'],
    priceEur: '1.890 €',
    priceUsd: '2.090 USD',
    purchaseUrl: 'https://refactika.com/ia-desarrollo',
    active: true
  }
];

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi(me: AuthUser = orientadorAdminFixture) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/auth/me')) return ok(me);
      if (url.endsWith('/api/orientador-ia/admin/leads')) return ok(leadsFixture);
      if (url.endsWith('/api/orientador-ia/admin/academies') && method === 'GET') return ok(academiesFixture);
      if (url.endsWith('/api/orientador-ia/admin/leads/export')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          blob: () => Promise.resolve(new Blob(['id,fullName\nlead-1,Ada Candidata'], { type: 'text/csv' }))
        });
      }
      if (url.includes('/api/orientador-ia/admin/academies/') && method === 'PUT') {
        const patch = JSON.parse(String(init?.body)) as Partial<OrientadorAcademy>;
        return ok({ ...academiesFixture[0], ...patch });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    })
  );
}

beforeEach(() => {
  window.history.replaceState({}, '', '/orientador-ia/admin');
  localStorage.setItem('awk.token', 'token-test');
  // jsdom no implementa URL.createObjectURL — stub mínimo para el botón de export.
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('OrientadorAdminPage (rol orientador_admin, D-025)', () => {
  it('lista leads con su perfil generado', async () => {
    mockApi();
    render(<App />);

    expect(await screen.findByText('Ada Candidata')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Desarrollo Web & Software')).toBeInTheDocument();
  });

  it('un admin de plataforma (rol admin, sin orientador_admin) también entra al panel', async () => {
    mockApi(platformAdminFixture);
    render(<App />);

    expect(await screen.findByTestId('shell-nav')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Orientador IA' })).toBeInTheDocument();
    expect(await screen.findByText('Ada Candidata')).toBeInTheDocument();
  });

  it('exporta los leads a CSV', async () => {
    mockApi();
    render(<App />);
    await screen.findByText('Ada Candidata');

    fireEvent.click(screen.getByTestId('export-button'));

    expect(await screen.findByText('Ada Candidata')).toBeInTheDocument(); // sigue visible, no rompe la vista
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('permite editar una academia y ver el cambio reflejado', async () => {
    mockApi();
    render(<App />);
    await screen.findByText('Ada Candidata');

    fireEvent.click(screen.getByText('Academias'));
    fireEvent.click(await screen.findByText('Editar'));

    const priceInput = await screen.findByDisplayValue('1.890 €');
    fireEvent.change(priceInput, { target: { value: '1.990 €' } });
    fireEvent.click(screen.getByTestId('academy-save-button'));

    expect(await screen.findByText(/1\.990 €/)).toBeInTheDocument();
  });
});
