import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoSalasView } from './CatalogoSalasView';
import type { Sala } from './reserva-salas.types';

const salaActiva: Sala = {
  id: 'sala-1',
  nombre: 'Cian',
  capacidad: 6,
  equipamiento: 'Proyector',
  activa: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};
const salaBaja: Sala = { ...salaActiva, id: 'sala-2', nombre: 'Índigo', activa: false };

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi(salas: Sala[] = [salaActiva, salaBaja]) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/reserva-salas/salas?todas=true') return ok(salas);
    if (url === '/api/reserva-salas/salas' && init?.method === 'POST') {
      return ok({ ...salaActiva, id: 'sala-3', nombre: 'Ágora', capacidad: 4, equipamiento: null });
    }
    if (url === '/api/reserva-salas/salas/sala-1/toggle-activa' && init?.method === 'PATCH') {
      return ok({ ...salaActiva, activa: false });
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
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('CatalogoSalasView', () => {
  it('pinta el catálogo con salas activas y de baja (todas=true)', async () => {
    const fetchMock = mockApi();
    render(<CatalogoSalasView />);

    expect(await screen.findByText('Cian')).toBeInTheDocument();
    expect(screen.getByText('Índigo')).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();
    expect(screen.getByText('De baja')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/reserva-salas/salas?todas=true')).toBe(true);
  });

  it('da de alta una sala tras confirmar el formulario', async () => {
    const fetchMock = mockApi();
    render(<CatalogoSalasView />);

    await screen.findByText('Cian');
    fireEvent.change(screen.getByTestId('nueva-sala-nombre'), { target: { value: 'Ágora' } });
    fireEvent.change(screen.getByTestId('nueva-sala-capacidad'), { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('anadir-sala'));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/reserva-salas/salas' && init?.method === 'POST')
      ).toBe(true)
    );
  });

  it('rechaza el alta sin nombre, sin llamar al backend', async () => {
    const fetchMock = mockApi();
    render(<CatalogoSalasView />);

    await screen.findByText('Cian');
    fireEvent.click(screen.getByTestId('anadir-sala'));

    expect(await screen.findByText(/Indica un nombre/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('dar de baja pide confirmación y llama al toggle', async () => {
    const fetchMock = mockApi();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CatalogoSalasView />);

    await screen.findByText('Cian');
    fireEvent.click(screen.getAllByTestId('toggle-activa')[0]!);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => String(url) === '/api/reserva-salas/salas/sala-1/toggle-activa' && init?.method === 'PATCH'
        )
      ).toBe(true)
    );
  });

  it('cancelar la confirmación NO llama al toggle', async () => {
    const fetchMock = mockApi();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<CatalogoSalasView />);

    await screen.findByText('Cian');
    fireEvent.click(screen.getAllByTestId('toggle-activa')[0]!);

    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });
});
