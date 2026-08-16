import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import { ReservaSalasPage } from './ReservaSalasPage';

const empleadoFixture: AuthUser = {
  id: 'u-empleado',
  email: 'marta@awakelab.dev',
  displayName: 'Marta Ruiz',
  roles: ['empleado']
};
const recepcionFixture: AuthUser = {
  id: 'u-recepcion',
  email: 'recepcion@awakelab.dev',
  displayName: 'Recepción',
  roles: ['recepcion']
};

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi(me: AuthUser) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/auth/me')) return ok(me);
    if (url.startsWith('/api/reserva-salas/salas')) return ok([]);
    if (url.startsWith('/api/reserva-salas/reservas')) return ok([]);
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/reserva-salas']}>
        <ReservaSalasPage />
      </MemoryRouter>
    </AuthProvider>
  );
}

beforeEach(() => {
  localStorage.setItem('awk.token', 'token-test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('ReservaSalasPage', () => {
  it('empleado: NO ve la pestaña "Salas" (solo Recepción gestiona el catálogo)', async () => {
    mockApi(empleadoFixture);
    renderPage();

    expect(await screen.findByTestId('reserva-salas-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('tab-mis-reservas')).toHaveTextContent('Mis reservas');
    expect(screen.queryByTestId('tab-catalogo')).not.toBeInTheDocument();
  });

  it('recepción: ve la pestaña "Salas" y el título "Todas las reservas"', async () => {
    mockApi(recepcionFixture);
    renderPage();

    expect(await screen.findByTestId('tab-catalogo')).toBeInTheDocument();
    expect(screen.getByTestId('tab-mis-reservas')).toHaveTextContent('Todas las reservas');
  });

  it('cambiar de pestaña muestra la vista correspondiente', async () => {
    mockApi(recepcionFixture);
    renderPage();

    await screen.findByTestId('reserva-salas-tabs');
    fireEvent.click(screen.getByTestId('tab-catalogo'));
    expect(await screen.findByTestId('nueva-sala-nombre')).toBeInTheDocument();
  });
});
