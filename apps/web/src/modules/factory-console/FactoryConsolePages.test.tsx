import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, FactoryProjectDetail, FactoryProjectSummary } from '@awk/types';
import { App } from '../../App';

const adminFixture: AuthUser = {
  id: 'u-1',
  email: 'leonardo.barreto@awakelab.dev',
  displayName: 'Leonardo Barreto',
  roles: ['admin']
};

const summaryFixture: FactoryProjectSummary = {
  id: 'proj-1',
  createdAt: '2026-07-15T09:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
  moduleSlug: 'orientador-ia',
  displayName: 'Orientador IA',
  requestedBy: 'leonardo.barreto@awakelab.dev',
  sourceType: 'manual',
  status: 'pending_approval',
  latestSpecVersion: 1,
  pendingGates: 2
};

function buildDetail(overrides: Partial<FactoryProjectDetail> = {}): FactoryProjectDetail {
  return {
    id: 'proj-1',
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
    moduleSlug: 'orientador-ia',
    displayName: 'Orientador IA',
    requestedBy: 'leonardo.barreto@awakelab.dev',
    sourceType: 'manual',
    status: 'pending_approval',
    sourceRef: '/ruta/al/prototipo',
    specs: [
      {
        id: 'spec-1',
        createdAt: '2026-07-15T09:30:00.000Z',
        version: 1,
        functionalContent: '# Spec funcional\nEl gerente valida esto.',
        technicalContent: '# Spec técnica\nModelos Prisma y endpoints.',
        complexityScore: 3,
        sensitivityFlags: ['datos_personales'],
        reuseNotes: 'Reutiliza el core de auth (D-011).',
        gates: [
          {
            id: 'gate-1',
            createdAt: '2026-07-15T09:30:00.000Z',
            gateType: 'functional',
            status: 'pending',
            reviewer: null,
            decisionNotes: null,
            decidedAt: null
          },
          {
            id: 'gate-2',
            createdAt: '2026-07-15T09:30:00.000Z',
            gateType: 'technical',
            status: 'approved',
            reviewer: 'leonardo.barreto@awakelab.dev',
            decisionNotes: 'modelo de datos ok',
            decidedAt: '2026-07-15T09:45:00.000Z'
          }
        ]
      }
    ],
    runs: [
      {
        id: 'run-1',
        createdAt: '2026-07-15T09:10:00.000Z',
        startedAt: '2026-07-15T09:10:00.000Z',
        finishedAt: '2026-07-15T09:30:00.000Z',
        runType: 'analysis',
        status: 'success',
        branchName: null,
        prUrl: null,
        outputSummary: 'spec v1 generada',
        errorMessage: null,
        costUsd: 0.42,
        inputTokens: 1000,
        outputTokens: 2000
      }
    ],
    ...overrides
  };
}

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi(options: { projects?: FactoryProjectSummary[]; detail?: FactoryProjectDetail } = {}) {
  const decideCalls: Array<{ url: string; body: unknown }> = [];
  let detail = options.detail ?? buildDetail();
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/auth/me')) return ok(adminFixture);
      if (url.endsWith('/factory-api/projects')) return ok(options.projects ?? [summaryFixture]);
      if (url.endsWith('/factory-api/projects/proj-1')) return ok(detail);
      if (url.includes('/factory-api/gates/') && method === 'POST') {
        decideCalls.push({ url, body: JSON.parse(String(init?.body)) });
        // Tras decidir, el gate queda aprobado y el recargue del detalle lo refleja.
        detail = buildDetail({
          specs: detail.specs.map((spec) => ({
            ...spec,
            gates: spec.gates.map((gate) =>
              gate.id === 'gate-1'
                ? {
                    ...gate,
                    status: 'approved' as const,
                    reviewer: adminFixture.email,
                    decidedAt: '2026-07-15T11:00:00.000Z'
                  }
                : gate
            )
          }))
        });
        return ok({
          id: 'gate-1',
          createdAt: '2026-07-15T09:30:00.000Z',
          gateType: 'functional',
          status: 'approved',
          reviewer: adminFixture.email,
          decisionNotes: null,
          decidedAt: '2026-07-15T11:00:00.000Z'
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    })
  );
  return { decideCalls };
}

beforeEach(() => {
  localStorage.setItem('awk.token', 'token-test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('FactoryProjectsPage (rol admin, D-030)', () => {
  it('lista los proyectos del pipeline con estado, spec y gates pendientes', async () => {
    window.history.replaceState({}, '', '/factory');
    mockApi();
    render(<App />);

    const table = within(await screen.findByTestId('factory-projects-table'));
    // "Orientador IA" también existe como ítem del nav del shell — scope a la tabla.
    expect(table.getByText('Orientador IA')).toBeInTheDocument();
    expect(table.getByText('Pendiente de aprobación')).toBeInTheDocument();
    expect(table.getByText('v1')).toBeInTheDocument();
    expect(table.getByText('2')).toBeInTheDocument(); // gates pendientes
  });

  it('sin proyectos, sugiere crear el primero por CLI', async () => {
    window.history.replaceState({}, '', '/factory');
    mockApi({ projects: [] });
    render(<App />);

    expect(await screen.findByTestId('factory-projects-empty')).toBeInTheDocument();
  });
});

describe('FactoryProjectDetailPage (rol admin, D-030)', () => {
  it('muestra stepper, spec (funcional/técnica) y gates con su estado', async () => {
    window.history.replaceState({}, '', '/factory/proj-1');
    mockApi();
    render(<App />);

    expect(await screen.findByTestId('factory-stepper')).toBeInTheDocument();
    // Spec funcional visible por defecto; la técnica tras cambiar de pestaña.
    expect(screen.getByTestId('factory-spec-content').textContent).toContain('El gerente valida esto');
    // La spec se renderiza como markdown (SpecMarkdown), no como texto plano:
    // el "# Spec funcional" del fixture debe volverse un heading real, sin
    // el "#" literal en pantalla.
    expect(screen.getByRole('heading', { name: 'Spec funcional' })).toBeInTheDocument();
    expect(screen.getByTestId('factory-spec-content').textContent).not.toContain('#');
    fireEvent.click(screen.getByRole('button', { name: 'Técnica' }));
    expect(screen.getByTestId('factory-spec-content').textContent).toContain('Modelos Prisma');
    expect(screen.getByRole('heading', { name: 'Spec técnica' })).toBeInTheDocument();
    // Gate técnico ya decidido: sin botones, con reviewer y notas.
    expect(screen.getByTestId('factory-gate-technical')).toHaveTextContent('Aprobado');
    expect(screen.getByTestId('factory-gate-technical')).toHaveTextContent('modelo de datos ok');
    // Historial reconstruido de specs/gates/runs.
    expect(screen.getByTestId('factory-history')).toHaveTextContent('Spec v1 generada');
    expect(screen.getByTestId('factory-history')).toHaveTextContent('Análisis (ok)');
  });

  it('aprobar un gate pendiente hace POST con la decisión y recarga el detalle', async () => {
    window.history.replaceState({}, '', '/factory/proj-1');
    const { decideCalls } = mockApi();
    render(<App />);

    await screen.findByTestId('factory-gate-functional');
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }));

    // Tras el POST, la página recarga el detalle y el gate funcional pasa a Aprobado.
    await waitFor(() =>
      expect(screen.getByTestId('factory-gate-functional')).toHaveTextContent('Aprobado')
    );
    expect(decideCalls).toHaveLength(1);
    expect(decideCalls[0]?.url).toContain('/factory-api/gates/gate-1/decision');
    expect(decideCalls[0]?.body).toEqual({ decision: 'approved' });
  });

  it('rechazar exige comentario: el botón queda deshabilitado sin notas', async () => {
    window.history.replaceState({}, '', '/factory/proj-1');
    mockApi();
    render(<App />);

    await screen.findByTestId('factory-gate-functional');
    const rejectButton = screen.getByRole('button', { name: 'Rechazar' });
    expect(rejectButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Comentario para Gate funcional (gerente)'), {
      target: { value: 'No corresponde a un módulo' }
    });
    expect(rejectButton).toBeEnabled();
  });

  it('estados fuera del camino feliz se muestran como alerta', async () => {
    window.history.replaceState({}, '', '/factory/proj-1');
    mockApi({ detail: buildDetail({ status: 'error' }) });
    render(<App />);

    expect(await screen.findByTestId('factory-detour')).toBeInTheDocument();
    expect(screen.getByTestId('factory-project-status')).toHaveTextContent('Error');
  });
});
