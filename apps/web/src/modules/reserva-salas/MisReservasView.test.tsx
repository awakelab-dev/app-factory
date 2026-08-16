import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MisReservasView } from './MisReservasView';
import type { Reserva } from './reserva-salas.types';

const miaFixture: Reserva = {
  id: 'reserva-1',
  salaId: 'sala-1',
  salaNombre: 'Cian',
  fecha: '2026-08-20',
  hora: '09:00',
  userId: 'u-empleado',
  personaNombre: 'Marta Ruiz',
  motivo: 'Sync semanal',
  createdAt: '2026-08-01T00:00:00.000Z',
  canceladaAt: null
};

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi(rows: Reserva[] = [miaFixture]) {
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/reserva-salas/reservas') return ok(rows);
    if (url === '/api/reserva-salas/reservas/reserva-1') return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) });
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

describe('MisReservasView', () => {
  it('empleado: título "Mis reservas" y filas de reservas propias', async () => {
    mockApi();
    render(<MisReservasView isRecepcion={false} />);
    expect(await screen.findByText('Mis reservas')).toBeInTheDocument();
    expect(screen.getByTestId('reservas-table')).toBeInTheDocument();
    expect(screen.getByText('Cian')).toBeInTheDocument();
    // Sin columna "A nombre de" para empleado (siempre son sus propias reservas).
    expect(screen.queryByText('A nombre de')).not.toBeInTheDocument();
  });

  it('recepción: título "Todas las reservas" y columna "A nombre de"', async () => {
    mockApi();
    render(<MisReservasView isRecepcion={true} />);
    expect(await screen.findByText('Todas las reservas')).toBeInTheDocument();
    expect(screen.getByText('A nombre de')).toBeInTheDocument();
    expect(screen.getByText('Marta Ruiz')).toBeInTheDocument();
  });

  it('lista vacía muestra un mensaje en vez de la tabla', async () => {
    mockApi([]);
    render(<MisReservasView isRecepcion={false} />);
    expect(await screen.findByText('Todavía no tienes reservas.')).toBeInTheDocument();
    expect(screen.queryByTestId('reservas-table')).not.toBeInTheDocument();
  });

  it('cancelar pide confirmación explícita antes de llamar al DELETE', async () => {
    const fetchMock = mockApi();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MisReservasView isRecepcion={false} />);

    fireEvent.click(await screen.findByTestId('cancelar-reserva'));
    expect(window.confirm).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  });

  it('confirmando la cancelación, llama al DELETE y recarga', async () => {
    const fetchMock = mockApi();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MisReservasView isRecepcion={false} />);

    fireEvent.click(await screen.findByTestId('cancelar-reserva'));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => String(url) === '/api/reserva-salas/reservas/reserva-1' && init?.method === 'DELETE'
        )
      ).toBe(true)
    );
  });
});
