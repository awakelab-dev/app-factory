import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { factoryProjectsResponseSchema, type FactoryProjectSummary } from '@awk/types';
import { apiFetch } from '../../lib/api';
import { PROJECT_STATUS_LABEL, formatDateTime, statusBadgeClass } from './pipeline-labels';

type ProjectsState =
  | { status: 'loading' }
  | { status: 'ok'; projects: FactoryProjectSummary[] }
  | { status: 'error'; detail: string };

/**
 * Lista de proyectos del pipeline (GET /factory-api/projects). Los proyectos
 * se crean por CLI (create-project, D-029) — aquí solo se siguen y aprueban.
 */
export function FactoryProjectsPage() {
  const [state, setState] = useState<ProjectsState>({ status: 'loading' });

  useEffect(() => {
    apiFetch('/factory-api/projects', factoryProjectsResponseSchema)
      .then((projects) => setState({ status: 'ok', projects }))
      .catch((err: unknown) =>
        setState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold text-white">
        Fábrica <span className="text-awk-cyan-400">·</span> proyectos
      </h1>
      <p className="mt-2 text-awk-blue-300">
        Pipeline prototipo → módulo (docs/04). Los proyectos y los runs de análisis/generación se
        lanzan por CLI; aquí se sigue su estado y se deciden los gates.
      </p>

      <section className="mt-8 overflow-hidden rounded-xl border border-awk-blue-700">
        {state.status === 'loading' && (
          <p className="bg-awk-navy-800 p-6 text-awk-blue-300">Cargando proyectos…</p>
        )}

        {state.status === 'error' && (
          <p className="bg-awk-navy-800 p-6 text-red-400" data-testid="factory-projects-error">
            No se pudo cargar la lista ({state.detail}). ¿Está corriendo el servidor de la Fábrica
            (pnpm --filter=@awk/factory serve)?
          </p>
        )}

        {state.status === 'ok' && state.projects.length === 0 && (
          <p className="bg-awk-navy-800 p-6 text-awk-blue-300" data-testid="factory-projects-empty">
            Sin proyectos todavía. Crea el primero con el CLI:{' '}
            <code className="text-awk-cyan-100">
              pnpm --filter=@awk/factory run cli -- create-project …
            </code>
          </p>
        )}

        {state.status === 'ok' && state.projects.length > 0 && (
          <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid="factory-projects-table">
            <thead>
              <tr className="border-b border-awk-blue-700 text-awk-blue-300">
                <th className="px-4 py-3 font-medium">Proyecto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Spec</th>
                <th className="px-4 py-3 font-medium">Gates pendientes</th>
                <th className="px-4 py-3 font-medium">Solicitado por</th>
                <th className="px-4 py-3 font-medium">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {state.projects.map((project) => (
                <tr key={project.id} className="border-b border-awk-blue-800 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/factory/${project.id}`}
                      className="font-medium text-awk-cyan-300 hover:text-awk-cyan-100"
                    >
                      {project.displayName}
                    </Link>
                    <div className="text-xs text-awk-blue-400">{project.moduleSlug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(project.status)}`}>
                      {PROJECT_STATUS_LABEL[project.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-awk-blue-50">
                    {project.latestSpecVersion === null ? '—' : `v${project.latestSpecVersion}`}
                  </td>
                  <td className="px-4 py-3">
                    {project.pendingGates > 0 ? (
                      <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-400">
                        {project.pendingGates}
                      </span>
                    ) : (
                      <span className="text-awk-blue-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-awk-blue-300">{project.requestedBy}</td>
                  <td className="px-4 py-3 text-awk-blue-300">{formatDateTime(project.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
