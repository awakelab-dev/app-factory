import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import { DashboardPage } from './DashboardPage';
import type { GestorDashboard } from './gestor-proyectos.types';

const adminFixture: AuthUser = {
  id: 'u-1',
  email: 'leonardo.barreto@awakelab.dev',
  displayName: 'Leonardo Barreto',
  roles: ['admin']
};

const dashboardFixture: GestorDashboard = {
  activeProjects: 2,
  pendingTasks: 3,
  finishedTasks: 5,
  overdueTasks: 1,
  myTasks: [
    {
      id: 't-1',
      projectId: 'p-1',
      sprintId: 's-1',
      title: 'Preparar demo',
      status: 'en_progreso',
      dueDate: '2026-07-25',
      assigneeId: 'u-1',
      assigneeName: 'Leonardo Barreto',
      createdById: 'u-1',
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
      subtasks: [],
      comments: [],
      permissions: { canChangeStatus: true, canAddInfo: true, canEditTask: true, canDeleteTask: true }
    }
  ],
  overdue: []
};

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return ok(adminFixture);
      if (url.endsWith('/api/gestor-proyectos/dashboard')) return ok(dashboardFixture);
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

describe('DashboardPage', () => {
  it('pinta los KPIs y "mis tareas" del dashboard', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/gestor-proyectos']}>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByText('Preparar demo')).toBeInTheDocument();
    expect(screen.getByTestId('my-tasks-table')).toBeInTheDocument();
    expect(screen.getByTestId('overdue-tasks-empty')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // activeProjects
  });

  it('si falla la carga, muestra el aviso de error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/auth/me')) return ok(adminFixture);
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      })
    );
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/gestor-proyectos']}>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByTestId('dashboard-error')).toBeInTheDocument();
  });
});
