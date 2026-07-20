import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import { FocusPage } from './FocusPage';
import type { FocusSettings, FocusTask, FocusTimerState } from './focus-flow.types';

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
  autoStartBreaks: false,
  autoStartFocus: false,
  notificationsEnabled: true,
  projectedFocusMinutesPerDay: 600,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z'
};

const taskFixture: FocusTask = {
  id: 't-1',
  title: 'Diseñar wireframes',
  estimatedPomodoros: 3,
  completedPomodoros: 1,
  done: false,
  position: 0,
  taskDate: '2026-07-19',
  sourceProyectosTaskId: null,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z'
};

/** En pausa: sin `phaseStartedAt` (nunca corriendo al recargar), 300s ya
 * transcurridos de los 1500s de un foco de 25 min → hidrata en 20:00. */
const pausedTimerStateFixture: FocusTimerState = {
  id: 'ts-1',
  phase: 'focus',
  round: 2,
  taskId: taskFixture.id,
  phaseStartedAt: null,
  accumulatedSeconds: 300,
  running: false,
  updatedAt: '2026-07-19T00:00:00.000Z'
};

/** "Fase vencida" (gate técnico change-2): quedaba corriendo hace mucho más
 * tiempo del que le quedaba a la fase — el cálculo da remaining=0. */
const expiredTimerStateFixture: FocusTimerState = {
  id: 'ts-2',
  phase: 'focus',
  round: 1,
  taskId: null,
  phaseStartedAt: '2020-01-01T00:00:00.000Z',
  accumulatedSeconds: 0,
  running: true,
  updatedAt: '2020-01-01T00:00:00.000Z'
};

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

/** `timerState` por defecto `null` (usuario nuevo, gate técnico change-2) —
 * los tests que la ejercitan pasan un fixture explícito. */
function mockApi(timerState: FocusTimerState | null = null) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/auth/me')) return ok(userFixture);
      if (url.endsWith('/api/focus-flow/settings')) return ok(settingsFixture);
      if (url.endsWith('/api/focus-flow/tasks') && method === 'GET') return ok([taskFixture]);
      if (url.endsWith('/api/focus-flow/timer-state') && method === 'GET') return ok(timerState);
      if (url.endsWith('/api/focus-flow/timer-state') && method === 'PUT') {
        const body = JSON.parse(String(init?.body)) as Partial<FocusTimerState>;
        return ok({ ...pausedTimerStateFixture, ...body });
      }
      if (url.endsWith(`/api/focus-flow/tasks/${taskFixture.id}`) && method === 'PATCH') {
        const body = JSON.parse(String(init?.body)) as Partial<FocusTask>;
        return ok({ ...taskFixture, ...body });
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

describe('FocusPage', () => {
  it('muestra el reloj con la duración configurada y la tarea actual', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow']}>
          <FocusPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByTestId('timer-clock')).toHaveTextContent('25:00');
    // El título aparece tanto en el panel "Tarea actual" como en la cola.
    expect(screen.getAllByText('Diseñar wireframes').length).toBeGreaterThanOrEqual(2);
  });

  it('marcar una tarea como completada llama al PATCH correspondiente', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow']}>
          <FocusPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId(`focus-task-done-${taskFixture.id}`);
    fireEvent.click(screen.getByTestId(`focus-task-done-${taskFixture.id}`));

    const fetchMock = vi.mocked(fetch);
    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([input, init]) => String(input).endsWith(`/api/focus-flow/tasks/${taskFixture.id}`) && init?.method === 'PATCH'
      );
      expect(patchCall).toBeDefined();
    });
  });

  it('hidrata el reloj desde GET /timer-state en vez de arrancar en 25:00 (change-2)', async () => {
    mockApi(pausedTimerStateFixture);
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow']}>
          <FocusPage />
        </MemoryRouter>
      </AuthProvider>
    );

    // 1500s nominales - 300s ya acumulados, en pausa (sin phaseStartedAt) → 20:00.
    expect(await screen.findByTestId('timer-clock')).toHaveTextContent('20:00');
    expect(screen.getByTestId('toggle-timer-button')).toHaveTextContent('Iniciar');
  });

  it('fase vencida al reabrir: hidrata en 00:00 y en pausa, sin autocompletar (gate técnico change-2)', async () => {
    mockApi(expiredTimerStateFixture);
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow']}>
          <FocusPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByTestId('timer-clock')).toHaveTextContent('00:00');
    expect(screen.getByTestId('toggle-timer-button')).toHaveTextContent('Iniciar');

    const fetchMock = vi.mocked(fetch);
    // Nunca se registra una sesión automáticamente por el solo hecho de hidratar.
    expect(
      fetchMock.mock.calls.find(([input]) => String(input).endsWith('/api/focus-flow/sessions'))
    ).toBeUndefined();
  });

  it('pausar el timer dispara un PUT /timer-state con el estado discreto (change-2)', async () => {
    mockApi(pausedTimerStateFixture);
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow']}>
          <FocusPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId('timer-clock');
    fireEvent.click(screen.getByTestId('toggle-timer-button')); // Iniciar
    fireEvent.click(screen.getByTestId('toggle-timer-button')); // Pausar

    const fetchMock = vi.mocked(fetch);
    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        ([input, init]) => String(input).endsWith('/api/focus-flow/timer-state') && init?.method === 'PUT'
      );
      expect(putCalls.length).toBeGreaterThanOrEqual(2);
    });

    const putCalls = fetchMock.mock.calls.filter(
      ([input, init]) => String(input).endsWith('/api/focus-flow/timer-state') && init?.method === 'PUT'
    );
    const lastBody = JSON.parse(String(putCalls.at(-1)?.[1]?.body)) as { running: boolean; phaseStartedAt: unknown };
    expect(lastBody.running).toBe(false);
    expect(lastBody.phaseStartedAt).toBeNull();
  });
});
