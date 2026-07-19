import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import type { FocusSettings } from './focus-flow.types';
import { SettingsPage } from './SettingsPage';

const userFixture: AuthUser = {
  id: 'u-1',
  email: 'leonardo.barreto@awakelab.dev',
  displayName: 'Leonardo Barreto',
  roles: ['user']
};

const settingsFixture: FocusSettings = {
  id: 's-1',
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  notificationsEnabled: true,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z'
};

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/auth/me')) return ok(userFixture);
      if (url.endsWith('/api/focus-flow/settings') && method === 'GET') return ok(settingsFixture);
      if (url.endsWith('/api/focus-flow/settings') && method === 'PUT') {
        const body = JSON.parse(String(init?.body)) as Partial<FocusSettings>;
        return ok({ ...settingsFixture, ...body });
      }
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

describe('SettingsPage', () => {
  it('carga la configuración y permite ajustar un stepper y guardar', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow/settings']}>
          <SettingsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByTestId('focusMinutes-value')).toHaveTextContent('25');

    fireEvent.click(screen.getByTestId('focusMinutes-increment'));
    expect(screen.getByTestId('focusMinutes-value')).toHaveTextContent('26');

    fireEvent.click(screen.getByTestId('save-settings-button'));
    expect(await screen.findByText('Guardado.')).toBeInTheDocument();

    const fetchMock = vi.mocked(fetch);
    const putCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith('/api/focus-flow/settings') && init?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual(expect.objectContaining({ focusMinutes: 26 }));
  });

  it('no permite bajar de 1 minuto en el stepper de descanso corto', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow/settings']}>
          <SettingsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId('shortBreakMinutes-value');
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByTestId('shortBreakMinutes-decrement'));
    expect(screen.getByTestId('shortBreakMinutes-value')).toHaveTextContent('1');
  });

  it('el interruptor "Sonido al terminar" del prototipo no existe en el MVP', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow/settings']}>
          <SettingsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId('notifications-enabled');
    expect(screen.queryByText(/sonido al terminar/i)).not.toBeInTheDocument();
  });

  it('el thumb del interruptor refleja aria-checked=false/true al alternar (change-1, corrección visual)', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow/settings']}>
          <SettingsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    const notificationsSwitch = await screen.findByTestId('notifications-enabled');
    expect(notificationsSwitch).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(notificationsSwitch);
    expect(notificationsSwitch).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(notificationsSwitch);
    expect(notificationsSwitch).toHaveAttribute('aria-checked', 'true');
  });
});
