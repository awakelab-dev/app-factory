import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import type { FocusPerformance } from './focus-flow.types';
import { PerformancePage } from './PerformancePage';

const userFixture: AuthUser = {
  id: 'u-1',
  email: 'leonardo.barreto@awakelab.dev',
  displayName: 'Leonardo Barreto',
  roles: ['user']
};

const weekFixture: FocusPerformance = {
  range: 'week',
  points: [
    {
      label: '2026-07-19',
      pomodorosCompleted: 4,
      tasksCompletionRatePct: 50,
      effectiveFocusPct: 80,
      workedMinutes: 300,
      projectedMinutes: 600
    }
  ],
  streakDays: 3,
  averagePomodorosPerDay: 4
};
const monthFixture: FocusPerformance = { ...weekFixture, range: 'month', averagePomodorosPerDay: 3.5 };

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return ok(userFixture);
      if (url.includes('/api/focus-flow/performance?range=week')) return ok(weekFixture);
      if (url.includes('/api/focus-flow/performance?range=month')) return ok(monthFixture);
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

describe('PerformancePage', () => {
  it('carga el rango semanal por defecto y muestra la racha', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow/performance']}>
          <PerformancePage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByTestId('stat-streak')).toHaveTextContent('3');
  });

  it('muestra la tarjeta de horas proyectadas vs. trabajadas (change-3)', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow/performance']}>
          <PerformancePage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByText('Horas proyectadas vs. trabajadas')).toBeInTheDocument();
  });

  it('cambiar a "4 semanas" vuelve a pedir el rango month', async () => {
    mockApi();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/focus-flow/performance']}>
          <PerformancePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId('stat-streak');
    fireEvent.click(screen.getByTestId('range-month'));

    const fetchMock = vi.mocked(fetch);
    expect(await screen.findByTestId('stat-average')).toHaveTextContent('3.5');
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/api/focus-flow/performance?range=month'))
    ).toBe(true);
  });
});
