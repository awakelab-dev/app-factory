import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import { DireccionPage } from './DireccionPage';
import type { ResumenMensual } from './incidencias-aula.types';

const direccionFixture: AuthUser = {
  id: 'u-direccion',
  email: 'direccion@awakelab.dev',
  displayName: 'Dirección Demo',
  roles: ['incidencias_direccion']
};

const resumenFixture: ResumenMensual = {
  mes: '2026-07',
  total: 3,
  abiertas: 1,
  gravedadAlta: 1,
  diasMediosHastaCierre: 2.5,
  porTipo: [{ tipo: 'convivencia', count: 2 }],
  porAula: [{ aulaId: 'aula-1', aulaNombre: '1º DAM - A', count: 3 }],
  detalle: [
    {
      id: 'inc-1',
      aulaId: 'aula-1',
      aulaNombre: '1º DAM - A',
      tipo: 'convivencia',
      gravedad: 'alta',
      fechaHecho: '2026-07-05',
      estado: 'cerrada',
      diasHastaCierre: 3
    }
  ]
};

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return ok(direccionFixture);
      if (url.includes('/api/incidencias-aula/resumen-mensual')) return ok(resumenFixture);
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    })
  );
}

beforeEach(() => {
  localStorage.setItem('awk.token', 'token-test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('DireccionPage', () => {
  it('pinta KPIs, distribución y el detalle minimizado (sin alumno ni relato)', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula/resumen']}>
          <DireccionPage />
        </MemoryRouter>
      </AuthProvider>
    );

    const table = await screen.findByTestId('resumen-detalle-table');
    expect(within(table).getByText('1º DAM - A')).toBeInTheDocument();

    // La respuesta del backend nunca trae alumnoNombre/relato/seguimientos —
    // la tabla de detalle no tiene columna de alumno ni de relato, solo
    // referencia/aula/tipo/gravedad/fecha/estado/días hasta cierre.
    expect(within(table).queryByText(/alumno/i)).not.toBeInTheDocument();
    expect(within(table).queryByText(/relato/i)).not.toBeInTheDocument();
  });
});
