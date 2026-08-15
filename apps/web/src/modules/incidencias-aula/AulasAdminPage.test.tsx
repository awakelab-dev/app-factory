import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import { AulasAdminPage } from './AulasAdminPage';
import type { Aula } from './incidencias-aula.types';

const adminFixture: AuthUser = {
  id: 'u-admin',
  email: 'admin@awakelab.dev',
  displayName: 'Admin Demo',
  roles: ['admin']
};

const aulasFixture: Aula[] = [
  { id: 'aula-1', nombre: '1º DAM - A', activa: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'aula-2', nombre: '2º DAW', activa: false, createdAt: '2026-01-01T00:00:00.000Z' }
];

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/auth/me')) return ok(adminFixture);
    if (url.includes('/api/incidencias-aula/aulas?todas=1')) return ok(aulasFixture);
    if (url.match(/\/api\/incidencias-aula\/aulas\/aula-2$/) && init?.method === 'PATCH') {
      return ok({ ...aulasFixture[1], activa: true });
    }
    if (url.endsWith('/api/incidencias-aula/aulas') && init?.method === 'POST') {
      return ok({ id: 'aula-3', nombre: '1º Marketing', activa: true, createdAt: '2026-01-01T00:00:00.000Z' });
    }
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

describe('AulasAdminPage', () => {
  it('pinta activas e inactivas (pantalla solo-admin, incluye ?todas=1)', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula/aulas']}>
          <AulasAdminPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByText(/1º DAM - A/)).toBeInTheDocument();
    expect(screen.getByText(/2º DAW/)).toBeInTheDocument();
    expect(screen.getByText('(inactiva)')).toBeInTheDocument();
  });

  it('crear una aula llama a POST /aulas', async () => {
    const fetchMock = mockApi();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula/aulas']}>
          <AulasAdminPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId('aulas-list');
    fireEvent.change(screen.getByTestId('nueva-aula-input'), { target: { value: '1º Marketing' } });
    fireEvent.click(screen.getByTestId('crear-aula-button'));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]: [RequestInfo | URL, RequestInit?]) =>
          String(url).endsWith('/api/incidencias-aula/aulas') ? init?.method === 'POST' : false
        )
      ).toBe(true)
    );
  });

  it('activar/desactivar llama a PATCH /aulas/:id sin borrar la fila', async () => {
    const fetchMock = mockApi();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/incidencias-aula/aulas']}>
          <AulasAdminPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByText('(inactiva)');
    const toggleButtons = screen.getAllByTestId('toggle-activa-button');
    fireEvent.click(toggleButtons[1]!);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]: [RequestInfo | URL, RequestInit?]) =>
          String(url).endsWith('/api/incidencias-aula/aulas/aula-2') ? init?.method === 'PATCH' : false
        )
      ).toBe(true)
    );
  });
});
