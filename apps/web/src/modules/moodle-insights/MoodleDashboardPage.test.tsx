import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, MoodleCourseRow, MoodleStudentRow, MoodleSummary, MoodleSyncRun } from '@awk/types';
import { App } from '../../App';

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

const adminFixture: AuthUser = {
  id: 'u-1',
  email: 'leonardo.barreto@awakelab.dev',
  displayName: 'Leonardo Barreto',
  roles: ['admin']
};
const userFixture: AuthUser = { ...adminFixture, id: 'u-2', roles: ['user'] };

const summaryFixture: MoodleSummary = {
  totalCourses: 1,
  visibleCourses: 1,
  totalStudents: 1,
  totalEnrollments: 1,
  avgGrade: 8,
  coursesByCategory: [{ categoryName: 'Ciencias', count: 1 }],
  lastSync: {
    id: 'run-1',
    status: 'success',
    startedAt: minutesAgo(6),
    finishedAt: minutesAgo(5),
    coursesCount: 1,
    studentsCount: 1,
    enrollmentsCount: 1,
    errorMessage: null
  }
};
const coursesFixture: MoodleCourseRow[] = [
  {
    id: 'c-1',
    moodleId: 12,
    shortname: 'MAT101',
    fullname: 'Matemáticas I',
    categoryName: 'Ciencias',
    visible: true,
    studentsCount: 1,
    avgGrade: 8
  }
];
const studentsFixture: MoodleStudentRow[] = [
  { id: 's-1', moodleId: 1, fullname: 'Alumna Uno', email: 'a1@test.dev', coursesCount: 1, avgGrade: 8 }
];
const syncRunFixture: MoodleSyncRun = { ...summaryFixture.lastSync! };

function mockApi(me: AuthUser, syncResponse: () => Promise<unknown> = () => ok(syncRunFixture)) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/auth/me')) return ok(me);
      if (url.endsWith('/api/moodle-insights/summary')) return ok(summaryFixture);
      if (url.endsWith('/api/moodle-insights/courses')) return ok(coursesFixture);
      if (url.endsWith('/api/moodle-insights/students')) return ok(studentsFixture);
      if (url.endsWith('/api/moodle-insights/sync') && method === 'POST') return syncResponse();
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    })
  );
}

beforeEach(() => {
  window.history.replaceState({}, '', '/moodle-insights');
  localStorage.setItem('awk.token', 'token-test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('MoodleDashboardPage', () => {
  it('admin: carga KPIs y tablas, y puede sincronizar', async () => {
    mockApi(adminFixture);
    render(<App />);

    expect(await screen.findByText('Matemáticas I')).toBeInTheDocument();
    expect(screen.getByText('Alumna Uno')).toBeInTheDocument();
    expect(screen.getByText('Actualizado hace 5 min')).toBeInTheDocument();

    const syncButton = screen.getByTestId('sync-button');
    expect(syncButton).not.toBeDisabled();

    fireEvent.click(syncButton);
    expect(await screen.findByText('Actualizado hace 5 min')).toBeInTheDocument();

    const fetchMock = vi.mocked(fetch);
    const syncCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith('/api/moodle-insights/sync') && init?.method === 'POST'
    );
    expect(syncCall).toBeDefined();
  });

  it('usuario sin admin: el botón de sincronizar está deshabilitado', async () => {
    mockApi(userFixture);
    render(<App />);

    expect(await screen.findByText('Matemáticas I')).toBeInTheDocument();
    expect(screen.getByTestId('sync-button')).toBeDisabled();
  });

  it('sin MOODLE_URL/MOODLE_TOKEN configuradas, el sync falla con un aviso claro', async () => {
    mockApi(adminFixture, () => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) }));
    render(<App />);

    expect(await screen.findByText('Matemáticas I')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('sync-button'));

    expect(await screen.findByTestId('sync-error')).toHaveTextContent(
      'MOODLE_URL/MOODLE_TOKEN no están configuradas todavía'
    );
  });
});
