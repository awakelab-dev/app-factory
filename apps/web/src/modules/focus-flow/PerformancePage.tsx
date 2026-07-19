import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch } from '../../lib/api';
import { focusPerformanceSchema, type FocusPerformance, type FocusPerformanceRange } from './focus-flow.types';

const CHART_GRID = '#27334f';
const CHART_AXIS = '#72a3c4';
const CHART_TOOLTIP_STYLE = { background: '#012142', border: '1px solid #314668', color: '#f0f3fc', fontSize: 12 };

type PerformanceState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; performance: FocusPerformance };

/**
 * Desempeño (spec-tecnica.md `GET /focus-flow/performance?range=week|month`):
 * series reales de pomodoros/tasa de finalización/foco efectivo + racha de
 * días — definiciones aprobadas en el gate técnico, decisión 4.
 */
export function PerformancePage() {
  const [range, setRange] = useState<FocusPerformanceRange>('week');
  const [state, setState] = useState<PerformanceState>({ status: 'loading' });

  useEffect(() => {
    setState({ status: 'loading' });
    apiFetch(`/api/focus-flow/performance?range=${range}`, focusPerformanceSchema)
      .then((performance) => setState({ status: 'ok', performance }))
      .catch((err: unknown) =>
        setState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, [range]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold text-white">
            Desempeño <span className="text-awk-cyan-400">·</span> analiza tu productividad
          </h1>
          <p className="mt-2 text-sm text-awk-blue-300">Tendencia real de pomodoros y foco efectivo.</p>
        </div>
        <div className="inline-flex gap-1 rounded-full border border-awk-blue-700 bg-awk-navy-900 p-1">
          {(['week', 'month'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                range === r ? 'bg-awk-cyan-500 text-awk-navy-900' : 'text-awk-blue-300 hover:text-white'
              }`}
              data-testid={`range-${r}`}
            >
              {r === 'week' ? 'Semana' : '4 semanas'}
            </button>
          ))}
        </div>
      </header>

      {state.status === 'loading' && <p className="text-awk-blue-300">Cargando…</p>}
      {state.status === 'error' && (
        <p className="text-red-400" data-testid="performance-error">
          No se pudo cargar el desempeño ({state.detail}).
        </p>
      )}
      {state.status === 'ok' && <PerformanceBody performance={state.performance} />}
    </div>
  );
}

function PerformanceBody({ performance }: { performance: FocusPerformance }) {
  return (
    <>
      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Pomodoros por bloque" hint={performance.range === 'week' ? 'Últimos 7 días' : 'Últimas 4 semanas'}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={performance.points} margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="label" stroke={CHART_AXIS} fontSize={11} />
              <YAxis stroke={CHART_AXIS} fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="pomodorosCompleted" name="Pomodoros" fill="#19F7F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tasa de finalización de tareas" hint="Tareas completadas vs. planificadas, por bloque">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={performance.points} margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="label" stroke={CHART_AXIS} fontSize={11} />
              <YAxis stroke={CHART_AXIS} fontSize={12} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="tasksCompletionRatePct" name="% completado" fill="#4E7EA5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <ChartCard title="Tendencia de foco efectivo" hint="Completadas / (completadas + saltadas), por bloque">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={performance.points} margin={{ left: 8, right: 8 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="label" stroke={CHART_AXIS} fontSize={11} />
            <YAxis stroke={CHART_AXIS} fontSize={12} unit="%" domain={[0, 100]} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="effectiveFocusPct"
              name="Foco efectivo"
              stroke="#0FCED3"
              strokeWidth={3}
              dot={{ fill: '#19F7F1' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pomodoros totales"
          value={performance.points.reduce((acc, p) => acc + p.pomodorosCompleted, 0)}
          testId="stat-total-pomodoros"
        />
        <StatCard label="Media diaria" value={performance.averagePomodorosPerDay} testId="stat-average" />
        <StatCard
          label="Racha de días"
          value={performance.streakDays}
          suffix={performance.streakDays > 0 ? ' 🔥' : ''}
          testId="stat-streak"
        />
        <StatCard
          label="Foco efectivo (último bloque)"
          value={performance.points.at(-1)?.effectiveFocusPct ?? 0}
          suffix="%"
          testId="stat-effective-focus"
        />
      </section>
    </>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-awk-blue-800 bg-awk-navy-800 p-4">
      <h2 className="text-sm font-medium text-awk-blue-100">{title}</h2>
      <p className="mb-3 text-xs text-awk-blue-400">{hint}</p>
      {children}
    </div>
  );
}

function StatCard({ label, value, suffix, testId }: { label: string; value: number; suffix?: string; testId: string }) {
  return (
    <div className="rounded-xl border border-awk-blue-800 bg-awk-navy-800 p-4">
      <p className="text-2xl font-semibold text-white" data-testid={testId}>
        {value}
        {suffix}
      </p>
      <p className="mt-1 text-xs text-awk-blue-400">{label}</p>
    </div>
  );
}
