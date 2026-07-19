import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Clock, ListTodo, Timer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { apiFetch } from '../../lib/api';
import { focusDashboardSchema, type FocusDashboard } from './focus-flow.types';

// Colores hex directos (no clases Tailwind): recharts los inyecta como
// atributos SVG — mismo criterio que MoodleDashboardPage.
const CHART_GRID = '#27334f';
const CHART_AXIS = '#72a3c4';
const CHART_TOOLTIP_STYLE = { background: '#012142', border: '1px solid #314668', color: '#f0f3fc', fontSize: 12 };
const DONUT_COLORS = ['#19F7F1', '#4E7EA5', '#314668'];

type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; dashboard: FocusDashboard };

/**
 * Dashboard de "hoy" (spec-tecnica.md `GET /focus-flow/dashboard`): KPIs y
 * gráficos calculados SOLO de `focus.sessions`/`focus.tasks` reales — gate
 * funcional, decisión 5 (prohibido cualquier número hardcodeado del
 * prototipo).
 */
export function DashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });

  useEffect(() => {
    apiFetch('/api/focus-flow/dashboard', focusDashboardSchema)
      .then((dashboard) => setState({ status: 'ok', dashboard }))
      .catch((err: unknown) =>
        setState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, []);

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold text-white">
          Dashboard <span className="text-awk-cyan-400">·</span> tu día de un vistazo
        </h1>
        <p className="mt-2 text-sm text-awk-blue-300">Pomodoros, minutos de enfoque y tareas de hoy.</p>
      </header>

      {state.status === 'loading' && <p className="text-awk-blue-300">Cargando…</p>}
      {state.status === 'error' && (
        <p className="text-red-400" data-testid="dashboard-error">
          No se pudo cargar el dashboard ({state.detail}).
        </p>
      )}
      {state.status === 'ok' && <DashboardBody dashboard={state.dashboard} />}
    </div>
  );
}

function DashboardBody({ dashboard }: { dashboard: FocusDashboard }) {
  const distribution = [
    { name: 'Completadas', value: dashboard.tasksCompletedToday },
    { name: 'En curso', value: dashboard.tasksInProgressToday },
    { name: 'Pendientes', value: dashboard.tasksPendingToday }
  ];
  const totalTasks = dashboard.tasksCompletedToday + dashboard.tasksInProgressToday + dashboard.tasksPendingToday;
  const hourlyChart = dashboard.hourlyDistribution
    .filter((b) => b.minutes > 0)
    .map((b) => ({ hour: `${b.hour}h`, minutes: b.minutes }));

  return (
    <>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Timer} label="Pomodoros hoy" value={dashboard.pomodorosCompletedToday} />
        <KpiCard icon={Clock} label="Minutos de enfoque" value={dashboard.focusMinutesToday} />
        <KpiCard icon={CheckCircle2} label="Tareas completadas" value={dashboard.tasksCompletedToday} />
        <KpiCard icon={ListTodo} label="Tareas pendientes" value={dashboard.tasksPendingToday} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Enfoque durante el día" hint="Minutos de concentración por franja horaria">
          {hourlyChart.length === 0 ? (
            <EmptyHint />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={hourlyChart} margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="hour" stroke={CHART_AXIS} fontSize={12} />
                <YAxis stroke={CHART_AXIS} fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="minutes" stroke="#19F7F1" fill="rgba(25,247,241,.25)" name="Minutos" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Distribución de tareas" hint="Estado de hoy">
          {totalTasks === 0 ? (
            <EmptyHint />
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={distribution} dataKey="value" innerRadius={70} outerRadius={100} paddingAngle={2}>
                    {distribution.map((entry, index) => (
                      <Cell key={entry.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <b className="text-2xl font-semibold text-white">
                  {totalTasks === 0 ? 0 : Math.round((dashboard.tasksCompletedToday / totalTasks) * 100)}%
                </b>
                <small className="text-xs text-awk-blue-400">avance</small>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-4">
                {distribution.map((entry, index) => (
                  <span key={entry.name} className="flex items-center gap-1.5 text-xs text-awk-blue-300">
                    <i className="h-2.5 w-2.5 rounded-sm" style={{ background: DONUT_COLORS[index] }} />
                    {entry.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </section>
    </>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-awk-blue-800 bg-awk-navy-800 p-4">
      <div className="flex items-center gap-2 text-awk-blue-300">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
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

function EmptyHint() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-awk-blue-400">
      Sin actividad todavía hoy — inicia un pomodoro en Enfoque.
    </div>
  );
}
