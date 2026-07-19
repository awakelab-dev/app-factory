import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import { FocusPage } from './FocusPage';
import type { FocusSettings, FocusTask } from './focus-flow.types';

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
      if (url.endsWith('/api/focus-flow/settings')) return ok(settingsFixture);
      if (url.endsWith('/api/focus-flow/tasks') && method === 'GET') return ok([taskFixture]);
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
});
