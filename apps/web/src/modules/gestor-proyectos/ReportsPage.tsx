import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import {
  gestorProjectDetailSchema,
  gestorReportSchema,
  type GestorProjectDetail,
  type GestorReport
} from './gestor-proyectos.types';
import { TASK_STATUS_LABEL } from './task-status-labels';

type ProjectState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; project: GestorProjectDetail };

type ReportState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; report: GestorReport };

/**
 * Reportes por proyecto+sprint (spec-tecnica.md `GET /gestor-proyectos/reports`):
 * KPIs, proyección (real vs. esperado por días hábiles), desglose por
 * estado y por persona — todo ya calculado server-side, aquí solo se pinta.
 */
export function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const sprintId = searchParams.get('sprintId');

  const [projectState, setProjectState] = useState<ProjectState>({ status: 'loading' });
  const [reportState, setReportState] = useState<ReportState>({ status: 'idle' });

  useEffect(() => {
    if (!projectId) return;
    apiFetch(`/api/gestor-proyectos/projects/${projectId}`, gestorProjectDetailSchema)
      .then((project) => {
        setProjectState({ status: 'ok', project });
        if (!sprintId && project.sprints.length > 0) {
          const last = project.sprints.at(-1);
          if (last) setSearchParams({ sprintId: last.id }, { replace: true });
        }
      })
      .catch((err: unknown) =>
        setProjectState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
    // Nota: este repo no tiene el plugin eslint react-hooks configurado (ver
    // eslint.config.mjs) — [projectId] es la única dependencia real que debe
    // re-disparar este efecto (`sprintId`/`setSearchParams` se leen pero no
    // deben reiniciar la carga del proyecto en cada cambio de sprint).
  }, [projectId]);

  const loadReport = useCallback(() => {
    if (!projectId || !sprintId) return;
    setReportState({ status: 'loading' });
    apiFetch(
      `/api/gestor-proyectos/reports?projectId=${encodeURIComponent(projectId)}&sprintId=${encodeURIComponent(sprintId)}`,
      gestorReportSchema
    )
      .then((report) => setReportState({ status: 'ok', report }))
      .catch((err: unknown) =>
        setReportState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, [projectId, sprintId]);

  useEffect(loadReport, [loadReport]);

  if (projectState.status === 'loading') return <p className="text-awk-blue-300">Cargando…</p>;
  if (projectState.status === 'error') {
    return (
      <p className="text-red-400" data-testid="reports-project-error">
        No se pudo cargar el proyecto ({projectState.detail}).
      </p>
    );
  }

  const { project } = projectState;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs text-awk-blue-400">
        <Link to={`/gestor-proyectos/projects/${project.id}`} className="hover:text-awk-cyan-300">
          {project.name}
        </Link>{' '}
        / Reportes
      </p>
      <h1 className="mt-1 text-3xl font-semibold text-white">Reportes</h1>

      <div className="mt-4 flex items-center gap-2">
        <label className="text-xs text-awk-blue-400">Sprint</label>
        <select
          value={sprintId ?? ''}
          onChange={(e) => setSearchParams({ sprintId: e.target.value })}
          className="rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-1.5 text-sm text-awk-blue-50"
          data-testid="report-sprint-select"
        >
          {project.sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name}
            </option>
          ))}
        </select>
      </div>

      {reportState.status === 'loading' && <p className="mt-6 text-awk-blue-300">Calculando…</p>}
      {reportState.status === 'error' && (
        <p className="mt-6 text-red-400" data-testid="report-error">
          No se pudo calcular el reporte ({reportState.detail}).
        </p>
      )}
      {reportState.status === 'ok' && <ReportBody report={reportState.report} />}
    </div>
  );
}

function ReportBody({ report }: { report: GestorReport }) {
  const { projection } = report;
  const delta = projection.actualProgressPct - projection.expectedProgressPct;

  return (
    <div className="mt-6 space-y-6">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Tareas" value={report.totalTasks} />
        <Kpi label="Finalizadas" value={report.finishedTasks} />
        <Kpi label="Atrasadas" value={report.overdueTasks} accent={report.overdueTasks > 0 ? 'text-red-400' : undefined} />
        <Kpi
          label="Avance vs. esperado"
          value={`${projection.actualProgressPct.toFixed(0)}% / ${projection.expectedProgressPct.toFixed(0)}%`}
          accent={delta < 0 ? 'text-amber-400' : 'text-emerald-400'}
        />
      </section>

      <section className="rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-4">
        <h2 className="text-sm font-medium text-awk-blue-100">Proyección</h2>
        <p className="mt-1 text-xs text-awk-blue-400">
          Día hábil {projection.workDaysElapsed} de {projection.workDaysTotal} del sprint.
        </p>
        <ProgressBar label="Avance esperado" pct={projection.expectedProgressPct} color="bg-awk-blue-500" />
        <ProgressBar label="Avance real" pct={projection.actualProgressPct} color="bg-awk-cyan-500" />
      </section>

      <section className="rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-4">
        <h2 className="text-sm font-medium text-awk-blue-100">Por estado</h2>
        <ul className="mt-2 space-y-1 text-sm" data-testid="report-by-status">
          {report.byStatus.map((row) => (
            <li key={row.status} className="flex justify-between text-awk-blue-200">
              <span>{TASK_STATUS_LABEL[row.status]}</span>
              <span>{row.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border border-awk-blue-700">
        <header className="border-b border-awk-blue-700 bg-awk-navy-800 px-4 py-3">
          <h2 className="text-sm font-medium text-awk-blue-100">Por persona</h2>
        </header>
        {report.byPerson.length === 0 ? (
          <p className="bg-awk-navy-800 p-6 text-sm text-awk-blue-400">Sin tareas en este sprint.</p>
        ) : (
          <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid="report-by-person">
            <thead>
              <tr className="border-b border-awk-blue-700 text-xs uppercase tracking-wide text-awk-blue-400">
                <th className="px-4 py-2 font-medium">Persona</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Finalizadas</th>
                <th className="px-4 py-2 text-right font-medium">Atrasadas</th>
              </tr>
            </thead>
            <tbody>
              {report.byPerson.map((row) => (
                <tr key={row.userId} className="border-b border-awk-blue-800 last:border-0">
                  <td className="px-4 py-2 text-awk-blue-50">{row.userName ?? row.userId}</td>
                  <td className="px-4 py-2 text-right text-awk-blue-100">{row.total}</td>
                  <td className="px-4 py-2 text-right text-awk-blue-100">{row.finished}</td>
                  <td className="px-4 py-2 text-right text-awk-blue-100">{row.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-awk-blue-800 bg-awk-navy-800 p-4">
      <p className="text-xs uppercase tracking-wide text-awk-blue-300">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${accent ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

function ProgressBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-awk-blue-400">
        <span>{label}</span>
        <span>{clamped.toFixed(0)}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-awk-blue-900">
        <div className={`h-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
