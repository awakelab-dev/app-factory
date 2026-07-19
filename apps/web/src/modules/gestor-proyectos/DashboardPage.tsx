import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FolderKanban, ListTodo } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { gestorDashboardSchema, type GestorDashboard, type GestorTaskRow } from './gestor-proyectos.types';
import { TASK_STATUS_ACCENT, TASK_STATUS_LABEL } from './task-status-labels';

type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; dashboard: GestorDashboard };

/**
 * Dashboard del gestor de proyectos (spec-tecnica.md `GET
 * /gestor-proyectos/dashboard`): KPIs + "mis tareas" + atrasadas, ya
 * filtrado server-side por lo que el usuario puede ver — no admin: solo sus
 * propias tareas; admin: toda la plataforma.
 */
export function DashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });

  useEffect(() => {
    apiFetch('/api/gestor-proyectos/dashboard', gestorDashboardSchema)
      .then((dashboard) => setState({ status: 'ok', dashboard }))
      .catch((err: unknown) =>
        setState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, []);

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold text-white">
          Gestor de Proyectos <span className="text-awk-cyan-400">·</span> dashboard
        </h1>
        <p className="mt-2 text-sm text-awk-blue-300">
          KPIs, tus tareas y atrasos. Ve a{' '}
          <Link to="/gestor-proyectos/projects" className="text-awk-cyan-300 hover:text-awk-cyan-100">
            Proyectos
          </Link>{' '}
          para el tablero kanban.
        </p>
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

function DashboardBody({ dashboard }: { dashboard: GestorDashboard }) {
  return (
    <>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={FolderKanban} label="Proyectos activos" value={dashboard.activeProjects} />
        <KpiCard icon={ListTodo} label="Tareas pendientes" value={dashboard.pendingTasks} />
        <KpiCard icon={CheckCircle2} label="Tareas finalizadas" value={dashboard.finishedTasks} />
        <KpiCard
          icon={AlertTriangle}
          label="Tareas atrasadas"
          value={dashboard.overdueTasks}
          accent={dashboard.overdueTasks > 0 ? 'text-red-400' : undefined}
        />
      </section>

      <TaskListSection
        title="Mis tareas"
        emptyHint="No tienes tareas pendientes."
        tasks={dashboard.myTasks}
        testId="my-tasks"
      />

      <TaskListSection
        title="Atrasadas"
        emptyHint="Nada atrasado por ahora."
        tasks={dashboard.overdue}
        testId="overdue-tasks"
      />
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-awk-blue-800 bg-awk-navy-800 p-4">
      <div className="flex items-center gap-2 text-awk-blue-300">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${accent ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

function TaskListSection({
  title,
  emptyHint,
  tasks,
  testId
}: {
  title: string;
  emptyHint: string;
  tasks: GestorTaskRow[];
  testId: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-awk-blue-700">
      <header className="border-b border-awk-blue-700 bg-awk-navy-800 px-4 py-3">
        <h2 className="text-sm font-medium text-awk-blue-100">
          {title} ({tasks.length})
        </h2>
      </header>
      {tasks.length === 0 ? (
        <p className="bg-awk-navy-800 p-6 text-sm text-awk-blue-400" data-testid={`${testId}-empty`}>
          {emptyHint}
        </p>
      ) : (
        <div className="max-h-[360px] overflow-y-auto">
          <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid={`${testId}-table`}>
            <thead className="sticky top-0 bg-awk-navy-800">
              <tr className="border-b border-awk-blue-700 text-xs uppercase tracking-wide text-awk-blue-400">
                <th className="px-4 py-2 font-medium">Tarea</th>
                <th className="px-4 py-2 font-medium">Asignado</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 text-right font-medium">Vence</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-awk-blue-800 last:border-0">
                  <td className="px-4 py-2">
                    <Link
                      to={`/gestor-proyectos/projects/${task.projectId}`}
                      className="text-awk-blue-50 hover:text-awk-cyan-300"
                    >
                      {task.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-awk-blue-300">{task.assigneeName ?? '—'}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-2 text-right text-awk-blue-100">{task.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function StatusBadge({ status }: { status: GestorTaskRow['status'] }): ReactNode {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${TASK_STATUS_ACCENT[status]}`}>
      {TASK_STATUS_LABEL[status]}
    </span>
  );
}
