import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import { DocentePage } from './DocentePage';
import type { Aula, IncidenciaDetail, IncidenciaRow } from './incidencias-aula.types';

const docenteFixture: AuthUser = {
  id: 'u-docente',
  email: 'docente@awakelab.dev',
  displayName: 'Docente Demo',
  roles: ['incidencias_docente']
};

const aulasFixture: Aula[] = [{ id: 'aula-1', nombre: '1º DAM - A', activa: true, createdAt: '2026-01-01T00:00:00.000Z' }];

const miaFixture: IncidenciaRow = {
  id: 'inc-1',
  alumnoNombre: 'Alumno Demo',
  aulaId: 'aula-1',
  aulaNombre: '1º DAM - A',
  tipo: 'convivencia',
  gravedad: 'media',
  fechaHecho: '2026-07-20',
  docenteId: 'u-docente',
  estado: 'abierta',
  createdAt: '2026-07-20T10:00:00.000Z',
  updatedAt: '2026-07-20T10:00:00.000Z'
};

const detailFixture: IncidenciaDetail = {
  ...miaFixture,
  relato: 'Relato objetivo de los hechos.',
  resolucion: null,
  cerradaAt: null,
  cerradaPorId: null,
  seguimientos: [],
  canTomar: false,
  canAct: false
};

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi(mias: IncidenciaRow[] = [miaFixture]) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/auth/me')) return ok(docenteFixture);
    if (url.endsWith('/api/incidencias-aula/aulas')) return ok(aulasFixture);
    if (url.endsWith('/api/incidencias-aula/incidencias/mias')) return ok(mias);
    if (url.endsWith('/api/incidencias-aula/incidencias/inc-1')) return ok(detailFixture);
    if (url.endsWith('/api/incidencias-aula/incidencias') && init?.method === 'POST') {
      return ok(miaFixture);
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.setItem('awk.token', 'token-test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('DocentePage', () => {
  it('pinta el catálogo de aulas y "mis incidencias"', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula']}>
          <DocentePage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByText('Alumno Demo')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '1º DAM - A' })).toBeInTheDocument();
  });

  it('registra una incidencia (POST con el payload del formulario)', async () => {
    const fetchMock = mockApi([]);
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula']}>
          <DocentePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('aula-select')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('alumno-input'), { target: { value: 'Alumno Demo' } });
    fireEvent.change(screen.getByTestId('relato-input'), { target: { value: 'Relato de prueba' } });
    fireEvent.click(screen.getByTestId('submit-incidencia'));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => String(url).endsWith('/api/incidencias-aula/incidencias') && init?.method === 'POST'
        )
      ).toBe(true)
    );
  });

  it('abre el detalle de solo lectura de una incidencia propia (sin botones de acción)', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula']}>
          <DocentePage />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.click(await screen.findByTestId('incidencia-row'));
    expect(await screen.findByText('Relato objetivo de los hechos.')).toBeInTheDocument();
    expect(screen.queryByTestId('tomar-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirmar-cerrar')).not.toBeInTheDocument();
  });
});
