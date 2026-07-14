import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, MoodleCourseRow, MoodleStudentRow, MoodleSummary, MoodleSyncRun } from '@awk/types';
import { App } from '../../App';
import { MOODLE_SYNC_POLL_INTERVAL_MS } from './MoodleDashboardPage';

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
// POST /sync ahora responde 'running' apenas se crea el sync_run — el fetch
// real a Moodle sigue en background (ver MOODLE_SYNC_POLL_INTERVAL_MS en el
// componente); el fixture 'success' de arriba es lo que /summary ya refleja
// una vez que el polling lo detecta.
const runningSyncRunFixture: MoodleSyncRun = { ...syncRunFixture, status: 'running', finishedAt: null };

function mockApi(me: AuthUser, syncResponse: () => Promise<unknown> = () => ok(runningSyncRunFixture)) {
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

    // POST /sync responde 'running' de inmediato; el componente espera
    // MOODLE_SYNC_POLL_INTERVAL_MS antes de volver a consultar /summary (que
    // ya refleja 'success' en el fixture) — fake timers para no esperar de
    // verdad esos segundos en el test.
    vi.useFakeTimers();
    try {
      fireEvent.click(syncButton);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(MOODLE_SYNC_POLL_INTERVAL_MS);
      });
    } finally {
      vi.useRealTimers();
    }

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

  it('si el sync termina en error durante el polling en background, muestra el aviso', async () => {
    // Reproduce el caso real (2026-07-13): POST /sync responde 'running' de
    // inmediato, y es GET /summary (por polling) el que eventualmente refleja
    // que Moodle rechazó el sync — no una respuesta directa de POST /sync.
    let summaryCallCount = 0;
    const erroredSummary: MoodleSummary = {
      ...summaryFixture,
      lastSync: {
        ...summaryFixture.lastSync!,
        status: 'error',
        finishedAt: minutesAgo(0),
        errorMessage: 'Moodle rechazó gradereport_user_get_grade_items (invalidresponse)'
      }
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.endsWith('/api/auth/me')) return ok(adminFixture);
        if (url.endsWith('/api/moodle-insights/summary')) {
          summaryCallCount += 1;
          // La primera llamada es la carga inicial del dashboard; recién a
          // partir de la segunda (el polling tras el click) Moodle "responde"
          // con el error.
          return ok(summaryCallCount === 1 ? summaryFixture : erroredSummary);
        }
        if (url.endsWith('/api/moodle-insights/courses')) return ok(coursesFixture);
        if (url.endsWith('/api/moodle-insights/students')) return ok(studentsFixture);
        if (url.endsWith('/api/moodle-insights/sync') && method === 'POST') return ok(runningSyncRunFixture);
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      })
    );

    render(<App />);
    expect(await screen.findByText('Matemáticas I')).toBeInTheDocument();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByTestId('sync-button'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(MOODLE_SYNC_POLL_INTERVAL_MS);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(await screen.findByTestId('sync-error')).toHaveTextContent('invalidresponse');
  });

  it('si al cargar el último sync sigue running (p.ej. tras navegar y volver), retoma el polling en vez de mostrar el botón libre', async () => {
    // Reproduce el caso real reportado por Leonardo (2026-07-14): el usuario
    // dispara el sync, navega a otra sección del shell y vuelve — React
    // remonta MoodleDashboardPage con `syncing` reiniciado a false, aunque el
    // backend siga procesando. El summary que trae el montaje nuevo ya debe
    // reflejar `lastSync.status === 'running'`, y el dashboard debe retomar
    // el polling (botón deshabilitado, "Actualizando…") en vez de mostrarse
    // libre y arriesgar un segundo click que dispare un sync duplicado.
    let summaryCallCount = 0;
    const runningSummary: MoodleSummary = {
      ...summaryFixture,
      lastSync: { ...summaryFixture.lastSync!, status: 'running', finishedAt: null }
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/auth/me')) return ok(adminFixture);
        if (url.endsWith('/api/moodle-insights/summary')) {
          summaryCallCount += 1;
          // 1ra llamada (montaje): el sync sigue 'running'. De la 2da en
          // adelante (polling retomado): ya terminó en 'success'.
          return ok(summaryCallCount === 1 ? runningSummary : summaryFixture);
        }
        if (url.endsWith('/api/moodle-insights/courses')) return ok(coursesFixture);
        if (url.endsWith('/api/moodle-insights/students')) return ok(studentsFixture);
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      })
    );

    render(<App />);
    expect(await screen.findByText('Matemáticas I')).toBeInTheDocument();

    // Sin ningún click del usuario, el botón ya debe verse "sincronizando".
    expect(await screen.findByText('Actualizando…')).toBeInTheDocument();
    expect(screen.getByTestId('sync-button')).toBeDisabled();

    // El efecto que retoma el polling agenda su `sleep()` en el mismo commit
    // que el render de "Matemáticas I" de arriba — no queda una ventana
    // limpia para instalar fake timers antes de eso (a diferencia de los
    // demás tests, donde el `sleep()` lo dispara un click explícito después
    // de instalar fake timers). Por eso este test espera el intervalo real
    // (con timeouts ampliados) en vez de pelear con fake timers.
    expect(
      await screen.findByText('Actualizar datos', {}, { timeout: MOODLE_SYNC_POLL_INTERVAL_MS + 4_000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('sync-button')).not.toBeDisabled();
  }, MOODLE_SYNC_POLL_INTERVAL_MS + 8_000);
});
