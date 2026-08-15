import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import { CoordinacionPage } from './CoordinacionPage';
import type { Aula, IncidenciaDetail, IncidenciaRow } from './incidencias-aula.types';

const coordinacionFixture: AuthUser = {
  id: 'u-coord',
  email: 'coord@awakelab.dev',
  displayName: 'Coordinación Demo',
  roles: ['incidencias_coordinacion']
};

const aulasFixture: Aula[] = [{ id: 'aula-1', nombre: '1º DAM - A', activa: true, createdAt: '2026-01-01T00:00:00.000Z' }];

const abiertaRow: IncidenciaRow = {
  id: 'inc-1',
  alumnoNombre: 'Alumno Abierto',
  aulaId: 'aula-1',
  aulaNombre: '1º DAM - A',
  tipo: 'convivencia',
  gravedad: 'alta',
  fechaHecho: '2026-07-20',
  docenteId: 'u-docente',
  estado: 'abierta',
  createdAt: '2026-07-20T10:00:00.000Z',
  updatedAt: '2026-07-20T10:00:00.000Z'
};

const cerradaRow: IncidenciaRow = {
  ...abiertaRow,
  id: 'inc-2',
  alumnoNombre: 'Alumno Cerrado',
  estado: 'cerrada',
  gravedad: 'baja'
};

const abiertaDetail: IncidenciaDetail = {
  ...abiertaRow,
  relato: 'Relato del caso abierto.',
  resolucion: null,
  cerradaAt: null,
  cerradaPorId: null,
  seguimientos: [],
  canTomar: true,
  canAct: true
};

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/auth/me')) return ok(coordinacionFixture);
    if (url.endsWith('/api/incidencias-aula/aulas')) return ok(aulasFixture);
    if (url.includes('/api/incidencias-aula/incidencias/inc-1/tomar') && init?.method === 'POST') {
      return ok({ ...abiertaDetail, estado: 'en_curso', canTomar: false });
    }
    if (url.includes('/api/incidencias-aula/incidencias/inc-1/cerrar') && init?.method === 'POST') {
      return ok({ ...abiertaDetail, estado: 'cerrada', canAct: false, canTomar: false, resolucion: 'Resuelto' });
    }
    if (url.endsWith('/api/incidencias-aula/incidencias/inc-1')) return ok(abiertaDetail);
    if (url.includes('/api/incidencias-aula/incidencias?')) return ok([abiertaRow]);
    if (url.endsWith('/api/incidencias-aula/incidencias')) return ok([abiertaRow, cerradaRow]);
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  localStorage.setItem('awk.token', 'token-test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('CoordinacionPage', () => {
  it('pinta KPIs (sobre la bandeja completa) y la tabla', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula/bandeja']}>
          <CoordinacionPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByText('Alumno Abierto')).toBeInTheDocument();
    expect(screen.getByText('Alumno Cerrado')).toBeInTheDocument();
    // KPI "Sin tomar" cuenta solo la fila "abierta".
    expect(screen.getByText('Sin tomar').parentElement?.parentElement).toHaveTextContent('1');
  });

  it('filtrar por estado vuelve a pedir la bandeja con el query param', async () => {
    const fetchMock = mockApi();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula/bandeja']}>
          <CoordinacionPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId('bandeja-table');
    fireEvent.change(screen.getByTestId('filtro-estado'), { target: { value: 'abierta' } });

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('estado=abierta'))).toBe(true)
    );
  });

  it('tomar el caso llama al endpoint /tomar', async () => {
    const fetchMock = mockApi();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula/bandeja']}>
          <CoordinacionPage />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.click(await screen.findByText('Alumno Abierto'));
    fireEvent.click(await screen.findByTestId('tomar-button'));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]) => (String(url).includes('/tomar') ? init?.method === 'POST' : false))
      ).toBe(true)
    );
  });

  it('cerrar exige resolución no vacía antes de llamar al backend', async () => {
    const fetchMock = mockApi();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula/bandeja']}>
          <CoordinacionPage />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.click(await screen.findByText('Alumno Abierto'));
    fireEvent.click(await screen.findByTestId('mostrar-cerrar'));
    fireEvent.click(screen.getByTestId('confirmar-cerrar'));

    expect(await screen.findByText('La resolución es obligatoria para cerrar la incidencia.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/cerrar'))).toBe(false);

    fireEvent.change(screen.getByTestId('resolucion-input'), { target: { value: 'Se habló con la familia.' } });
    fireEvent.click(screen.getByTestId('confirmar-cerrar'));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]) => (String(url).includes('/cerrar') ? init?.method === 'POST' : false))
      ).toBe(true)
    );
  });
});
