import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarioView } from './CalendarioView';
import type { Sala, SalaDetail } from './reserva-salas.types';

const salaFixture: Sala = {
  id: 'sala-1',
  nombre: 'Cian',
  capacidad: 6,
  equipamiento: 'Proyector',
  activa: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

function detailFixture(overrides: Partial<SalaDetail> = {}): SalaDetail {
  return {
    ...salaFixture,
    fecha: '2026-08-20',
    franjas: [
      { hora: '09:00', estado: 'libre', reservaId: null, ocupantePorLabel: null },
      { hora: '10:00', estado: 'tuya', reservaId: 'reserva-1', ocupantePorLabel: null },
      { hora: '11:00', estado: 'ocupada', reservaId: null, ocupantePorLabel: 'Javier' },
      { hora: '12:00', estado: 'libre', reservaId: null, ocupantePorLabel: null },
      { hora: '13:00', estado: 'libre', reservaId: null, ocupantePorLabel: null },
      { hora: '16:00', estado: 'libre', reservaId: null, ocupantePorLabel: null },
      { hora: '17:00', estado: 'libre', reservaId: null, ocupantePorLabel: null }
    ],
    ...overrides
  };
}

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi() {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/reserva-salas/salas/sala-1')) return ok(detailFixture());
    if (url === '/api/reserva-salas/salas') return ok([salaFixture]);
    if (url === '/api/reserva-salas/reservas' && init?.method === 'POST') {
      return ok({
        id: 'reserva-2',
        salaId: 'sala-1',
        salaNombre: 'Cian',
        fecha: '2026-08-20',
        hora: '09:00',
        userId: 'u-empleado',
        personaNombre: 'Marta Ruiz',
        motivo: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        canceladaAt: null
      });
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

describe('CalendarioView', () => {
  it('pinta la rejilla de salas x franjas con el estado de cada celda', async () => {
    mockApi();
    render(<CalendarioView isRecepcion={false} currentUserName="Marta Ruiz" />);

    expect(await screen.findByTestId('calendario-grid')).toBeInTheDocument();
    expect(screen.getByTestId('slot-sala-1-09:00')).toHaveTextContent('Libre');
    expect(screen.getByTestId('slot-sala-1-10:00')).toHaveTextContent('Tuya');
    expect(screen.getByTestId('slot-sala-1-11:00')).toHaveTextContent('Javier');
  });

  it('un clic en una celda "Libre" abre el diálogo de reserva', async () => {
    mockApi();
    render(<CalendarioView isRecepcion={false} currentUserName="Marta Ruiz" />);

    fireEvent.click(await screen.findByTestId('slot-sala-1-09:00'));
    expect(await screen.findByTestId('reserva-dialog')).toBeInTheDocument();
  });

  it('las celdas "Tuya" y "Ocupada" están deshabilitadas (no abren el diálogo)', async () => {
    mockApi();
    render(<CalendarioView isRecepcion={false} currentUserName="Marta Ruiz" />);

    await screen.findByTestId('calendario-grid');
    expect(screen.getByTestId('slot-sala-1-10:00')).toBeDisabled();
    expect(screen.getByTestId('slot-sala-1-11:00')).toBeDisabled();
  });

  it('confirmar la reserva llama al POST y recarga la rejilla', async () => {
    const fetchMock = mockApi();
    render(<CalendarioView isRecepcion={false} currentUserName="Marta Ruiz" />);

    fireEvent.click(await screen.findByTestId('slot-sala-1-09:00'));
    fireEvent.click(await screen.findByTestId('confirmar-reserva'));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => String(url) === '/api/reserva-salas/reservas' && init?.method === 'POST'
        )
      ).toBe(true)
    );
    await waitFor(() => expect(screen.queryByTestId('reserva-dialog')).not.toBeInTheDocument());
  });
});
