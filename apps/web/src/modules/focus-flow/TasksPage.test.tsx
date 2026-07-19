import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import type { FocusSettings, FocusTask, ImportFocusTasksResponse } from './focus-flow.types';
import { TasksPage } from './TasksPage';

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

const taskFixture: FocusTask = {
  id: 't-1',
  title: 'Escribir informe',
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

function mockApi(importResponse: ImportFocusTasksResponse) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/auth/me')) return ok(userFixture);
      if (url.endsWith('/api/focus-flow/settings')) return ok(settingsFixture);
      if (url.endsWith('/api/focus-flow/tasks') && method === 'GET') return ok([taskFixture]);
      if (url.endsWith('/api/focus-flow/tasks/import-from-proyectos') && method === 'POST') {
        return ok(importResponse);
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

describe('TasksPage', () => {
  it('pinta la cola de hoy y la estimación de cierre', async () => {
    mockApi({ imported: [], skippedAlreadyImported: 0 });
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow/tasks']}>
          <TasksPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByText('Escribir informe')).toBeInTheDocument();
    expect(screen.getByTestId('estimated-finish')).toBeInTheDocument();
  });

  it('"Importar mis tareas asignadas" añade las tareas importadas a la cola', async () => {
    const imported: FocusTask = {
      ...taskFixture,
      id: 't-2',
      title: 'Tarea importada',
      sourceProyectosTaskId: 'p-1',
      position: 1
    };
    mockApi({ imported: [imported], skippedAlreadyImported: 0 });
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow/tasks']}>
          <TasksPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByText('Escribir informe');
    fireEvent.click(screen.getByTestId('import-button'));

    expect(await screen.findByText('Tarea importada')).toBeInTheDocument();
    expect(await screen.findByText(/Importadas 1 tarea/)).toBeInTheDocument();
  });
});
