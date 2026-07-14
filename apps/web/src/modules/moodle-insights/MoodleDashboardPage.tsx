import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  moodleCoursesResponseSchema,
  moodleStudentsResponseSchema,
  moodleSummarySchema,
  moodleSyncRunSchema,
  type MoodleCourseRow,
  type MoodleStudentRow,
  type MoodleSummary
} from '@awk/types';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Percent,
  RefreshCw,
  Users,
  XCircle
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@awk/ui';
import { useAuth } from '../../auth/auth-context';
import { ApiError, apiFetch } from '../../lib/api';

type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; summary: MoodleSummary; courses: MoodleCourseRow[]; students: MoodleStudentRow[] };

// Colores hex directos (no clases Tailwind): recharts los inyecta como
// atributos SVG (stroke/fill), que no pasan por el pipeline de utilidades.
const CHART_GRID = '#27334f';
const CHART_AXIS = '#72a3c4';
const CHART_TOOLTIP_STYLE = {
  background: '#012142',
  border: '1px solid #314668',
  color: '#f0f3fc',
  fontSize: 12
};
const CHART_CURSOR = { fill: 'rgba(39, 51, 79, 0.4)' };

// "Cursos por categoría": nombre de categoría limitado a 2 líneas, con "…" si
// no entra. Wrap por palabra (no por caracter suelto) para que se lea bien.
const CATEGORY_LABEL_MAX_CHARS_PER_LINE = 13;
const CATEGORY_LABEL_MAX_LINES = 2;

function wrapCategoryLabel(label: string): string[] {
  const words = label.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > CATEGORY_LABEL_MAX_CHARS_PER_LINE && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= CATEGORY_LABEL_MAX_LINES) return lines;

  const visible = lines.slice(0, CATEGORY_LABEL_MAX_LINES);
  const last = visible[CATEGORY_LABEL_MAX_LINES - 1] ?? '';
  visible[CATEGORY_LABEL_MAX_LINES - 1] =
    last.length > CATEGORY_LABEL_MAX_CHARS_PER_LINE - 1
      ? `${last.slice(0, CATEGORY_LABEL_MAX_CHARS_PER_LINE - 1)}…`
      : `${last}…`;
  return visible;
}

/** Forma mínima que necesitamos del prop `tick` de recharts (Bar/XAxis/YAxis). */
interface AxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: string | number };
}

function CategoryAxisTick({ x, y, payload }: AxisTickProps) {
  const lines = wrapCategoryLabel(String(payload?.value ?? ''));
  const lineHeight = 12;
  const firstLineDy = lines.length > 1 ? -((lines.length - 1) * lineHeight) / 2 + 4 : 4;
  return (
    <text x={x} y={y} textAnchor="end" fill={CHART_AXIS} fontSize={11}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? firstLineDy : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

// "Top 10 cursos por promedio": shortname limitado a 5 caracteres + "…" en el
// eje (el hover/Tooltip sigue mostrando el nombre completo porque lee el dato
// original, no el texto truncado del tick).
const COURSE_LABEL_MAX_CHARS = 5;

function ShortnameAxisTick({ x, y, payload }: AxisTickProps) {
  const value = String(payload?.value ?? '');
  const label = value.length > COURSE_LABEL_MAX_CHARS ? `${value.slice(0, COURSE_LABEL_MAX_CHARS)}…` : value;
  return (
    <text x={x} y={(y ?? 0) + 12} textAnchor="middle" fill={CHART_AXIS} fontSize={12}>
      {label}
    </text>
  );
}

function formatRelative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

function formatGrade(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

// El backend responde a POST /sync apenas crea el sync_run ('running') — el
// fetch real a Moodle sigue en background y puede tardar varios minutos en
// instancias grandes (~9m45s validado con 627 cursos/5512 alumnos,
// 2026-07-13). En vez de sostener esa request HTTP abierta (frágil: timeout
// de proxy, pestaña cerrada, red inestable — el 504 real que motivó este
// cambio), el dashboard hace polling de GET /summary hasta que
// `lastSync.status` deja de ser 'running'.
export const MOODLE_SYNC_POLL_INTERVAL_MS = 3_000;
// ~15 min de margen sobre el peor caso medido (~10 min) antes de dejar de
// insistir y solo avisar — no es un límite del backend, el sync real sigue
// corriendo igual y una recarga manual del dashboard ya lo reflejaría.
const MOODLE_SYNC_MAX_POLL_ATTEMPTS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Página del primer módulo ejemplar (D-020/D-022): dashboard denso —
 * KPIs, gráficos y tablas — sobre el replicado de una instancia Moodle.
 * Nada aquí se actualiza sola: todo viene de GET /api/moodle-insights/*
 * y el botón "Actualizar datos" es el único disparador de POST /sync.
 */
export function MoodleDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;

  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  // Evita retomar el polling más de una vez por montaje del componente (ver
  // el efecto de abajo) — no tiene que ver con si el usuario ya sincronizó,
  // solo con no disparar dos loops de polling en paralelo.
  const hasResumedPollRef = useRef(false);
  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  const load = useCallback(async () => {
    try {
      const [summary, courses, students] = await Promise.all([
        apiFetch('/api/moodle-insights/summary', moodleSummarySchema),
        apiFetch('/api/moodle-insights/courses', moodleCoursesResponseSchema),
        apiFetch('/api/moodle-insights/students', moodleStudentsResponseSchema)
      ]);
      setState({ status: 'ok', summary, courses, students });
    } catch (err) {
      setState({ status: 'error', detail: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // El botón depende de `syncing` (estado local), pero ese estado se pierde
  // si el usuario navega a otra sección y vuelve — React remonta la página
  // con `syncing = false` aunque el sync siga corriendo de verdad en el
  // backend (fire-and-forget, D-022). Si al cargar el summary vemos
  // `lastSync.status === 'running'`, retomamos el polling en vez de mostrar
  // el botón como libre — evita que un segundo click dispare un sync
  // duplicado mientras el primero sigue en curso.
  useEffect(() => {
    if (state.status !== 'ok' || hasResumedPollRef.current) return;
    if (state.summary.lastSync?.status !== 'running') return;

    hasResumedPollRef.current = true;
    setSyncing(true);
    setSyncError(null);
    void waitForSyncToFinish()
      .then(() => {
        if (isMountedRef.current) return load();
      })
      .finally(() => {
        if (isMountedRef.current) setSyncing(false);
      });
    // Nota: este repo no tiene el plugin eslint react-hooks configurado
    // (ver eslint.config.mjs), así que no hace falta un disable de
    // exhaustive-deps aquí — [state] es la única dependencia real que debe
    // re-disparar este efecto.
  }, [state]);

  async function waitForSyncToFinish() {
    for (let attempt = 0; attempt < MOODLE_SYNC_MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(MOODLE_SYNC_POLL_INTERVAL_MS);
      if (!isMountedRef.current) return;

      const summary = await apiFetch('/api/moodle-insights/summary', moodleSummarySchema);
      if (summary.lastSync && summary.lastSync.status !== 'running') {
        if (summary.lastSync.status === 'error') {
          setSyncError(summary.lastSync.errorMessage ?? 'La sincronización terminó con error.');
        }
        return;
      }
    }
    setSyncError('La sincronización sigue corriendo en segundo plano — recarga en un momento para ver el resultado.');
  }

  async function onSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const run = await apiFetch('/api/moodle-insights/sync', moodleSyncRunSchema, { method: 'POST' });
      if (run.status === 'running') {
        await waitForSyncToFinish();
      } else if (run.status === 'error') {
        setSyncError(run.errorMessage ?? 'La sincronización terminó con error.');
      }
      if (isMountedRef.current) await load();
    } catch (err) {
      if (isMountedRef.current) {
        setSyncError(
          err instanceof ApiError && err.status === 503
            ? 'MOODLE_URL/MOODLE_TOKEN no están configuradas todavía (ver .env.example).'
            : err instanceof Error
              ? err.message
              : String(err)
        );
      }
    } finally {
      if (isMountedRef.current) setSyncing(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold text-white">
            Moodle Insights <span className="text-awk-cyan-400">·</span> dashboard
          </h1>
          <p className="mt-2 text-sm text-awk-blue-300">
            Réplica de solo lectura de cursos, alumnos y calificaciones de la instancia Moodle
            configurada. No se sincroniza sola: los datos son tan recientes como la última vez que
            alguien pulsó «Actualizar datos».
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button
            onClick={() => void onSync()}
            disabled={!isAdmin || syncing}
            title={isAdmin ? undefined : 'Solo un admin puede sincronizar'}
            data-testid="sync-button"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Actualizando…' : 'Actualizar datos'}
          </Button>
          {state.status === 'ok' && <SyncStatusBadge lastSync={state.summary.lastSync} />}
          {syncError && (
            <p className="max-w-xs text-right text-xs text-red-400" data-testid="sync-error">
              {syncError}
            </p>
          )}
        </div>
      </header>

      {state.status === 'loading' && <p className="text-awk-blue-300">Cargando…</p>}

      {state.status === 'error' && (
        <p className="text-red-400" data-testid="dashboard-error">
          No se pudo cargar el dashboard ({state.detail}).
        </p>
      )}

      {state.status === 'ok' && (
        <DashboardBody summary={state.summary} courses={state.courses} students={state.students} />
      )}
    </div>
  );
}

function SyncStatusBadge({ lastSync }: { lastSync: MoodleSummary['lastSync'] }) {
  if (!lastSync) {
    return (
      <p className="flex items-center gap-1 text-xs text-awk-blue-400">
        <Clock className="h-3 w-3" /> Nunca sincronizado
      </p>
    );
  }
  if (lastSync.status === 'error') {
    return (
      <p className="flex items-center gap-1 text-xs text-red-400">
        <XCircle className="h-3 w-3" /> Último intento falló ({formatRelative(lastSync.startedAt)})
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1 text-xs text-awk-cyan-400">
      <CheckCircle2 className="h-3 w-3" /> Actualizado{' '}
      {formatRelative(lastSync.finishedAt ?? lastSync.startedAt)}
    </p>
  );
}

function DashboardBody({
  summary,
  courses,
  students
}: {
  summary: MoodleSummary;
  courses: MoodleCourseRow[];
  students: MoodleStudentRow[];
}) {
  const gradedCourses = courses
    .filter((course) => course.avgGrade !== null)
    .sort((a, b) => (b.avgGrade ?? 0) - (a.avgGrade ?? 0))
    .slice(0, 10);

  // Redondeado a 1 decimal para el chart (tooltip incluido) — el promedio
  // "de verdad" (sin redondear) sigue disponible en la tabla de cursos.
  const gradedCoursesForChart = gradedCourses.map((course) => ({
    ...course,
    avgGrade: course.avgGrade === null ? null : Math.round(course.avgGrade * 10) / 10
  }));

  const topCategories = [...summary.coursesByCategory].sort((a, b) => b.count - a.count).slice(0, 10);

  return (
    <>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={BookOpen}
          label="Cursos"
          value={summary.totalCourses}
          hint={`${summary.visibleCourses} visibles`}
        />
        <KpiCard icon={Users} label="Alumnos" value={summary.totalStudents} />
        <KpiCard icon={GraduationCap} label="Matrículas" value={summary.totalEnrollments} />
        <KpiCard icon={Percent} label="Promedio global" value={formatGrade(summary.avgGrade)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Top 10 cursos por categoría">
          {topCategories.length === 0 ? (
            <EmptyHint />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={topCategories} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid stroke={CHART_GRID} horizontal={false} />
                <XAxis type="number" stroke={CHART_AXIS} fontSize={12} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="categoryName"
                  stroke={CHART_AXIS}
                  fontSize={12}
                  width={110}
                  tick={<CategoryAxisTick />}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} />
                <Bar dataKey="count" name="Cursos" fill="#11eaea" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top 10 cursos por promedio de calificación">
          {gradedCoursesForChart.length === 0 ? (
            <EmptyHint />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={gradedCoursesForChart} margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="shortname" stroke={CHART_AXIS} fontSize={12} tick={<ShortnameAxisTick />} />
                <YAxis stroke={CHART_AXIS} fontSize={12} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  cursor={CHART_CURSOR}
                  formatter={(value: unknown) => (typeof value === 'number' ? value.toFixed(1) : String(value ?? ''))}
                />
                <Bar dataKey="avgGrade" name="Promedio" fill="#0fced3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      <CoursesTable courses={courses} />
      <StudentsTable students={students} />
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-awk-blue-800 bg-awk-navy-800 p-4">
      <div className="flex items-center gap-2 text-awk-blue-300">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-awk-blue-400">{hint}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-awk-blue-800 bg-awk-navy-800 p-4">
      <h2 className="text-sm font-medium text-awk-blue-100">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center text-sm text-awk-blue-400">
      <AlertTriangle className="h-5 w-5" />
      Sin datos todavía — pulsa «Actualizar datos» para sincronizar.
    </div>
  );
}

function CoursesTable({ courses }: { courses: MoodleCourseRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-awk-blue-700">
      <header className="border-b border-awk-blue-700 bg-awk-navy-800 px-4 py-3">
        <h2 className="text-sm font-medium text-awk-blue-100">Cursos ({courses.length})</h2>
      </header>
      {courses.length === 0 ? (
        <p className="bg-awk-navy-800 p-6 text-sm text-awk-blue-400" data-testid="courses-empty">
          Sin cursos replicados todavía.
        </p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid="courses-table">
            <thead className="sticky top-0 bg-awk-navy-800">
              <tr className="border-b border-awk-blue-700 text-xs uppercase tracking-wide text-awk-blue-400">
                <th className="px-4 py-2 font-medium">Curso</th>
                <th className="px-4 py-2 font-medium">Categoría</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 text-right font-medium">Alumnos</th>
                <th className="px-4 py-2 text-right font-medium">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr
                  key={course.id}
                  className="border-b border-awk-blue-800 last:border-0 hover:bg-awk-blue-800/40"
                >
                  <td className="px-4 py-2">
                    <p className="text-awk-blue-50">{course.fullname}</p>
                    <p className="text-xs text-awk-blue-400">{course.shortname}</p>
                  </td>
                  <td className="px-4 py-2 text-awk-blue-300">{course.categoryName ?? 'Sin categoría'}</td>
                  <td className="px-4 py-2">
                    <span className={course.visible ? 'text-awk-cyan-400' : 'text-awk-blue-400'}>
                      {course.visible ? 'visible' : 'oculto'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-awk-blue-100">{course.studentsCount}</td>
                  <td className="px-4 py-2 text-right text-awk-blue-100">{formatGrade(course.avgGrade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StudentsTable({ students }: { students: MoodleStudentRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-awk-blue-700">
      <header className="border-b border-awk-blue-700 bg-awk-navy-800 px-4 py-3">
        <h2 className="text-sm font-medium text-awk-blue-100">Alumnos ({students.length})</h2>
      </header>
      {students.length === 0 ? (
        <p className="bg-awk-navy-800 p-6 text-sm text-awk-blue-400" data-testid="students-empty">
          Sin alumnos replicados todavía.
        </p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid="students-table">
            <thead className="sticky top-0 bg-awk-navy-800">
              <tr className="border-b border-awk-blue-700 text-xs uppercase tracking-wide text-awk-blue-400">
                <th className="px-4 py-2 font-medium">Alumno</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 text-right font-medium">Cursos</th>
                <th className="px-4 py-2 text-right font-medium">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr
                  key={student.id}
                  className="border-b border-awk-blue-800 last:border-0 hover:bg-awk-blue-800/40"
                >
                  <td className="px-4 py-2 text-awk-blue-50">{student.fullname}</td>
                  <td className="px-4 py-2 text-awk-blue-300">{student.email}</td>
                  <td className="px-4 py-2 text-right text-awk-blue-100">{student.coursesCount}</td>
                  <td className="px-4 py-2 text-right text-awk-blue-100">{formatGrade(student.avgGrade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
