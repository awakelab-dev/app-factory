import { useCallback, useEffect, useState } from 'react';
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

  async function onSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const run = await apiFetch('/api/moodle-insights/sync', moodleSyncRunSchema, { method: 'POST' });
      if (run.status === 'error') {
        setSyncError(run.errorMessage ?? 'La sincronización terminó con error.');
      }
      await load();
    } catch (err) {
      setSyncError(
        err instanceof ApiError && err.status === 503
          ? 'MOODLE_URL/MOODLE_TOKEN no están configuradas todavía (ver .env.example).'
          : err instanceof Error
            ? err.message
            : String(err)
      );
    } finally {
      setSyncing(false);
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
        <ChartCard title="Cursos por categoría">
          {summary.coursesByCategory.length === 0 ? (
            <EmptyHint />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={summary.coursesByCategory} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid stroke={CHART_GRID} horizontal={false} />
                <XAxis type="number" stroke={CHART_AXIS} fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="categoryName" stroke={CHART_AXIS} fontSize={12} width={110} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} />
                <Bar dataKey="count" name="Cursos" fill="#11eaea" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top 10 cursos por promedio de calificación">
          {gradedCourses.length === 0 ? (
            <EmptyHint />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={gradedCourses} margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="shortname" stroke={CHART_AXIS} fontSize={12} />
                <YAxis stroke={CHART_AXIS} fontSize={12} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} />
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
