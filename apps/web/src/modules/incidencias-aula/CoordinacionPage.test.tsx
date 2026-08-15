import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import { CoordinacionPage } from './CoordinacionPage';
import type { Aula, IncidenciaBandejaRow, IncidenciaDetail, IncidenciaRow } from './incidencias-aula.types';

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

// Filas de BANDEJA (mini-spec técnica, cambio 2): mismo contenido que
// `abiertaRow`/`cerradaRow` + `diasAbierta` — es lo que responde de verdad
// `GET .../incidencias` desde este cambio, y `incidenciasBandejaResponseSchema`
// exige el campo (parsear sin él fallaría).
const abiertaBandejaRow: IncidenciaBandejaRow = { ...abiertaRow, diasAbierta: 3 };
const cerradaBandejaRow: IncidenciaBandejaRow = { ...cerradaRow, diasAbierta: 45 };

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
    if (url.includes('/api/incidencias-aula/incidencias?')) return ok([abiertaBandejaRow]);
    if (url.endsWith('/api/incidencias-aula/incidencias')) return ok([abiertaBandejaRow, cerradaBandejaRow]);
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
}

/** Mock mínimo para tests centrados en el render de la tabla de bandeja
 * (columna "Días abierta", marca de estancamiento): las filas pasadas se
 * devuelven tal cual para CUALQUIER variante de `GET .../incidencias`
 * (filtrada o no) — estos tests no ejercitan el filtrado en sí. */
function mockApiForRows(rows: IncidenciaBandejaRow[]) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/auth/me')) return ok(coordinacionFixture);
    if (url.endsWith('/api/incidencias-aula/aulas')) return ok(aulasFixture);
    if (url.includes('/api/incidencias-aula/incidencias')) return ok(rows);
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

  it('el filtro de gravedad es visible y combinable con estado y aula (mini-spec técnica, cambio 2)', async () => {
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
    fireEvent.change(screen.getByTestId('filtro-gravedad'), { target: { value: 'alta' } });

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('gravedad=alta'))).toBe(true)
    );

    fireEvent.change(screen.getByTestId('filtro-estado'), { target: { value: 'abierta' } });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => String(url).includes('estado=abierta') && String(url).includes('gravedad=alta')
        )
      ).toBe(true)
    );
  });
});

describe('CoordinacionPage — columna "Días abierta" y marca de estancamiento (mini-spec técnica, cambio 2)', () => {
  it('la tabla muestra la columna "Días abierta" con el valor de cada fila', async () => {
    vi.stubGlobal('fetch', mockApiForRows([abiertaBandejaRow, cerradaBandejaRow]));
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula/bandeja']}>
          <CoordinacionPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId('bandeja-table');
    expect(screen.getByText('Días abierta')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('gate técnico, test exigido (c): la marca NO aparece a los 7 días exactos y SÍ a los 8', async () => {
    const limite: IncidenciaBandejaRow = {
      ...abiertaBandejaRow,
      id: 'inc-limite-7',
      alumnoNombre: 'Alumno Limite Siete',
      diasAbierta: 7
    };
    const pasadoElLimite: IncidenciaBandejaRow = {
      ...abiertaBandejaRow,
      id: 'inc-limite-8',
      alumnoNombre: 'Alumno Limite Ocho',
      diasAbierta: 8
    };
    vi.stubGlobal('fetch', mockApiForRows([limite, pasadoElLimite]));
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula/bandeja']}>
          <CoordinacionPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId('bandeja-table');
    const filaLimite = screen.getByText('Alumno Limite Siete').closest('tr');
    const filaPasadoElLimite = screen.getByText('Alumno Limite Ocho').closest('tr');
    expect(filaLimite && within(filaLimite).queryByTestId('estancada-marca')).toBeNull();
    expect(filaPasadoElLimite && within(filaPasadoElLimite).queryByTestId('estancada-marca')).not.toBeNull();
  });

  it('gate técnico, test exigido (d): la marca nunca aparece en una incidencia cerrada, por muchos días que lleve', async () => {
    const cerradaMuyEstancada: IncidenciaBandejaRow = {
      ...cerradaBandejaRow,
      id: 'inc-cerrada-vieja',
      alumnoNombre: 'Alumno Cerrado Antiguo',
      diasAbierta: 400
    };
    vi.stubGlobal('fetch', mockApiForRows([cerradaMuyEstancada]));
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula/bandeja']}>
          <CoordinacionPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId('bandeja-table');
    const fila = screen.getByText('Alumno Cerrado Antiguo').closest('tr');
    expect(fila && within(fila).queryByTestId('estancada-marca')).toBeNull();
  });

  it('la marca de estancamiento es accesible: icono + texto/title, no solo color (gate funcional, condición 4)', async () => {
    const estancada: IncidenciaBandejaRow = {
      ...abiertaBandejaRow,
      id: 'inc-estancada',
      alumnoNombre: 'Alumno Muy Estancado',
      estado: 'en_curso',
      diasAbierta: 20
    };
    vi.stubGlobal('fetch', mockApiForRows([estancada]));
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula/bandeja']}>
          <CoordinacionPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId('bandeja-table');
    const marca = screen.getByTestId('estancada-marca');
    expect(marca).toHaveAttribute('title');
    expect(marca).toHaveTextContent('Estancada');
  });
});
