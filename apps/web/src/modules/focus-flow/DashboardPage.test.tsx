import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import { DashboardPage } from './DashboardPage';
import type { FocusDashboard } from './focus-flow.types';

const userFixture: AuthUser = {
  id: 'u-1',
  email: 'leonardo.barreto@awakelab.dev',
  displayName: 'Leonardo Barreto',
  roles: ['user']
};

const dashboardFixture: FocusDashboard = {
  pomodorosCompletedToday: 4,
  focusMinutesToday: 100,
  tasksCompletedToday: 2,
  tasksInProgressToday: 1,
  tasksPendingToday: 3,
  hourlyDistribution: [{ hour: 9, minutes: 50 }, { hour: 10, minutes: 25 }]
};

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return ok(userFixture);
      if (url.endsWith('/api/focus-flow/dashboard')) return ok(dashboardFixture);
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
  it('pinta los KPIs reales del dashboard de hoy', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow/dashboard']}>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByText('4')).toBeInTheDocument(); // pomodorosCompletedToday
    expect(screen.getByText('100')).toBeInTheDocument(); // focusMinutesToday
  });

  it('si falla la carga, muestra el aviso de error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/auth/me')) return ok(userFixture);
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      })
    );
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow/dashboard']}>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByTestId('dashboard-error')).toBeInTheDocument();
  });
});
