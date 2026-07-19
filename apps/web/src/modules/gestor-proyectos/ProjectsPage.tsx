import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@awk/ui';
import { useAuth } from '../../auth/auth-context';
import { ApiError, apiFetch } from '../../lib/api';
import { apiDelete } from './gestor-proyectos-api';
import {
  gestorProjectDetailSchema,
  gestorProjectsResponseSchema,
  type CreateGestorProjectRequest,
  type GestorProjectSummary
} from './gestor-proyectos.types';

type ProjectsState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; projects: GestorProjectSummary[] };

const fieldClass =
  'w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none';

/**
 * Lista de proyectos (spec-tecnica.md `GET /gestor-proyectos/projects`):
 * admin ve todos; no-admin solo donde participa (≥1 tarea asignada) — el
 * filtrado ya viene hecho del backend, aquí solo se pinta.
 */
export function ProjectsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const [state, setState] = useState<ProjectsState>({ status: 'loading' });
  const [showForm, setShowForm] = useState(false);

  function load() {
    apiFetch('/api/gestor-proyectos/projects', gestorProjectsResponseSchema)
      .then((projects) => setState({ status: 'ok', projects }))
      .catch((err: unknown) =>
        setState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }

  useEffect(load, []);

  async function onDelete(projectId: string) {
    if (!window.confirm('¿Eliminar este proyecto? Se borran también sus sprints, tareas, subtareas y comentarios.')) {
      return;
    }
    await apiDelete(`/api/gestor-proyectos/projects/${projectId}`).catch(() => undefined);
    load();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">
            Gestor de Proyectos <span className="text-awk-cyan-400">·</span> proyectos
          </h1>
          <p className="mt-2 text-awk-blue-300">Tableros kanban por proyecto/sprint.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm((v) => !v)} data-testid="new-project-button">
            <Plus className="h-4 w-4" /> Nuevo proyecto
          </Button>
        )}
      </header>

      {showForm && (
        <NewProjectForm
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <section className="mt-8 overflow-hidden rounded-xl border border-awk-blue-700">
        {state.status === 'loading' && (
          <p className="bg-awk-navy-800 p-6 text-awk-blue-300">Cargando proyectos…</p>
        )}

        {state.status === 'error' && (
          <p className="bg-awk-navy-800 p-6 text-red-400" data-testid="projects-error">
            No se pudo cargar la lista ({state.detail}).
          </p>
        )}

        {state.status === 'ok' && state.projects.length === 0 && (
          <p className="bg-awk-navy-800 p-6 text-awk-blue-300" data-testid="projects-empty">
            {isAdmin ? 'Sin proyectos todavía — crea el primero.' : 'No participas en ningún proyecto todavía.'}
          </p>
        )}

        {state.status === 'ok' && state.projects.length > 0 && (
          <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid="projects-table">
            <thead>
              <tr className="border-b border-awk-blue-700 text-awk-blue-300">
                <th className="px-4 py-3 font-medium">Proyecto</th>
                <th className="px-4 py-3 text-right font-medium">Tareas</th>
                <th className="px-4 py-3 text-right font-medium">Abiertas</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {state.projects.map((project) => (
                <tr key={project.id} className="border-b border-awk-blue-800 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/gestor-proyectos/projects/${project.id}`}
                      className="font-medium text-awk-cyan-300 hover:text-awk-cyan-100"
                    >
                      {project.name}
                    </Link>
                    {project.description && (
                      <p className="text-xs text-awk-blue-400">{project.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-awk-blue-100">{project.tasksCount}</td>
                  <td className="px-4 py-3 text-right text-awk-blue-100">{project.openTasksCount}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void onDelete(project.id)}
                        className="text-awk-blue-400 hover:text-red-400"
                        title="Eliminar proyecto"
                        data-testid={`delete-project-${project.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function NewProjectForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: CreateGestorProjectRequest = { name: name.trim(), description: description.trim() || undefined };
      await apiFetch('/api/gestor-proyectos/projects', gestorProjectDetailSchema, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? `No se pudo crear (HTTP ${err.status}).` : 'No se pudo crear el proyecto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-awk-cyan-700 bg-awk-navy-800 p-4" data-testid="new-project-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-awk-blue-400">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs text-awk-blue-400">Descripción (opcional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => void onSubmit()} disabled={saving} data-testid="create-project-button">
          {saving ? 'Creando…' : 'Crear (Sprint 1 automático)'}
        </Button>
      </div>
    </div>
  );
}
