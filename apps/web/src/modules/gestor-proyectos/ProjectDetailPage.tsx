import { useCallback, useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { coreUsersResponseSchema, type CoreUser } from '@awk/types';
import { Plus } from 'lucide-react';
import { Button } from '@awk/ui';
import { useAuth } from '../../auth/auth-context';
import { ApiError, apiFetch } from '../../lib/api';
import {
  gestorProjectDetailSchema,
  gestorSprintSchema,
  gestorTaskRowSchema,
  gestorTasksResponseSchema,
  type CreateGestorTaskRequest,
  type GestorProjectDetail,
  type GestorTaskRow,
  type ProyectosTaskStatus
} from './gestor-proyectos.types';
import { TASK_STATUS_COLUMNS, TASK_STATUS_LABEL } from './task-status-labels';
import { TaskModal } from './TaskModal';

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; project: GestorProjectDetail };

type TasksState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; tasks: GestorTaskRow[] };

/**
 * Tablero kanban de un proyecto (spec-tecnica.md): selector de sprint,
 * columnas por estado con arrastrar-y-soltar nativo (HTML5 Drag and Drop —
 * sin `dnd-kit` ni otra librería, mismo criterio que el prototipo), crear
 * tarea y abrir el modal de detalle. El drag-and-drop es solo azúcar de UI:
 * cada `drop` dispara el mismo `PATCH /tasks/:id/status` que revalida
 * `canChangeStatus` en el backend — arrastrar una tarea que no es tuya la
 * deja donde estaba y el backend la rechaza.
 */
export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;

  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [tasksState, setTasksState] = useState<TasksState>({ status: 'loading' });
  const [creatingSprint, setCreatingSprint] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  const loadDetail = useCallback(() => {
    if (!projectId) return;
    apiFetch(`/api/gestor-proyectos/projects/${projectId}`, gestorProjectDetailSchema)
      .then((project) => {
        setDetail({ status: 'ok', project });
        setSelectedSprintId((current) => current ?? project.sprints.at(-1)?.id ?? null);
      })
      .catch((err: unknown) =>
        setDetail({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, [projectId]);

  useEffect(loadDetail, [loadDetail]);

  const loadTasks = useCallback(() => {
    if (!selectedSprintId) return;
    setTasksState({ status: 'loading' });
    apiFetch(`/api/gestor-proyectos/sprints/${selectedSprintId}/tasks`, gestorTasksResponseSchema)
      .then((tasks) => setTasksState({ status: 'ok', tasks }))
      .catch((err: unknown) =>
        setTasksState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, [selectedSprintId]);

  useEffect(loadTasks, [loadTasks]);

  async function onCreateSprint() {
    if (!projectId) return;
    setCreatingSprint(true);
    try {
      const sprint = await apiFetch(`/api/gestor-proyectos/projects/${projectId}/sprints`, gestorSprintSchema, {
        method: 'POST'
      });
      setSelectedSprintId(sprint.id);
      loadDetail();
    } finally {
      setCreatingSprint(false);
    }
  }

  function onTaskChanged(updated: GestorTaskRow) {
    setTasksState((prev) =>
      prev.status === 'ok' ? { status: 'ok', tasks: prev.tasks.map((t) => (t.id === updated.id ? updated : t)) } : prev
    );
  }

  function onTaskDeleted(taskId: string) {
    setTasksState((prev) =>
      prev.status === 'ok' ? { status: 'ok', tasks: prev.tasks.filter((t) => t.id !== taskId) } : prev
    );
    setActiveTaskId(null);
  }

  function onTaskCreated(task: GestorTaskRow) {
    setTasksState((prev) => (prev.status === 'ok' ? { status: 'ok', tasks: [...prev.tasks, task] } : prev));
    setShowNewTask(false);
  }

  async function onDrop(taskId: string, status: ProyectosTaskStatus) {
    setDropError(null);
    try {
      const updated = await apiFetch(`/api/gestor-proyectos/tasks/${taskId}/status`, gestorTaskRowSchema, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      onTaskChanged(updated);
    } catch (err) {
      setDropError(
        err instanceof ApiError && err.status === 403
          ? 'No puedes cambiar el estado de esa tarea.'
          : 'No se pudo mover la tarea.'
      );
    }
  }

  if (detail.status === 'loading') return <p className="text-awk-blue-300">Cargando…</p>;
  if (detail.status === 'error') {
    return (
      <p className="text-red-400" data-testid="project-detail-error">
        No se pudo cargar el proyecto ({detail.detail}).
      </p>
    );
  }

  const { project } = detail;
  const activeTask = tasksState.status === 'ok' ? tasksState.tasks.find((t) => t.id === activeTaskId) ?? null : null;

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-awk-blue-400">
            <Link to="/gestor-proyectos/projects" className="hover:text-awk-cyan-300">
              Proyectos
            </Link>{' '}
            / {project.name}
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-white">{project.name}</h1>
          {project.description && <p className="mt-2 max-w-2xl text-sm text-awk-blue-300">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/gestor-proyectos/projects/${project.id}/reports${selectedSprintId ? `?sprintId=${selectedSprintId}` : ''}`}
            className="text-sm text-awk-cyan-300 hover:text-awk-cyan-100"
          >
            Ver reportes
          </Link>
          {isAdmin && (
            <Button size="sm" variant="secondary" onClick={() => void onCreateSprint()} disabled={creatingSprint}>
              {creatingSprint ? 'Creando…' : '+ Sprint'}
            </Button>
          )}
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-awk-blue-400">Sprint</label>
          <select
            value={selectedSprintId ?? ''}
            onChange={(e) => setSelectedSprintId(e.target.value)}
            className="rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-1.5 text-sm text-awk-blue-50"
            data-testid="sprint-select"
          >
            {project.sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name} ({sprint.startDate} → {sprint.endDate})
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" onClick={() => setShowNewTask((v) => !v)} data-testid="new-task-button">
          <Plus className="h-4 w-4" /> Nueva tarea
        </Button>
      </div>

      {showNewTask && selectedSprintId && (
        <NewTaskForm
          sprintId={selectedSprintId}
          isAdmin={isAdmin}
          onCancel={() => setShowNewTask(false)}
          onCreated={onTaskCreated}
        />
      )}

      {dropError && <p className="mt-3 text-sm text-red-400">{dropError}</p>}

      {tasksState.status === 'loading' && <p className="mt-6 text-awk-blue-300">Cargando tablero…</p>}
      {tasksState.status === 'error' && (
        <p className="mt-6 text-red-400" data-testid="tasks-error">
          No se pudo cargar el tablero ({tasksState.detail}).
        </p>
      )}
      {tasksState.status === 'ok' && (
        <KanbanBoard tasks={tasksState.tasks} onDrop={onDrop} onOpenTask={setActiveTaskId} />
      )}

      {activeTask && (
        <TaskModal
          task={activeTask}
          isAdmin={isAdmin}
          onClose={() => setActiveTaskId(null)}
          onChanged={onTaskChanged}
          onDeleted={onTaskDeleted}
        />
      )}
    </div>
  );
}

function KanbanBoard({
  tasks,
  onDrop,
  onOpenTask
}: {
  tasks: GestorTaskRow[];
  onDrop: (taskId: string, status: ProyectosTaskStatus) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const [dragOverColumn, setDragOverColumn] = useState<ProyectosTaskStatus | null>(null);

  function handleDragStart(e: DragEvent<HTMLDivElement>, task: GestorTaskRow) {
    if (!task.permissions.canChangeStatus) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleColumnDrop(e: DragEvent<HTMLDivElement>, status: ProyectosTaskStatus) {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onDrop(taskId, status);
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-5" data-testid="kanban-board">
      {TASK_STATUS_COLUMNS.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverColumn(status);
            }}
            onDragLeave={() => setDragOverColumn((c) => (c === status ? null : c))}
            onDrop={(e) => handleColumnDrop(e, status)}
            className={`min-h-[200px] rounded-xl border p-2 transition-colors ${
              dragOverColumn === status
                ? 'border-awk-cyan-500 bg-awk-blue-900/40'
                : 'border-awk-blue-800 bg-awk-navy-900'
            }`}
            data-testid={`kanban-column-${status}`}
          >
            <h3 className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-awk-blue-300">
              {TASK_STATUS_LABEL[status]} ({columnTasks.length})
            </h3>
            <div className="mt-1 space-y-2">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  draggable={task.permissions.canChangeStatus}
                  onDragStart={(e) => handleDragStart(e, task)}
                  onClick={() => onOpenTask(task.id)}
                  className={`cursor-pointer rounded-lg border border-awk-blue-700 bg-awk-navy-800 p-3 text-sm hover:border-awk-cyan-600 ${
                    task.permissions.canChangeStatus ? 'cursor-grab' : ''
                  }`}
                  data-testid={`task-card-${task.id}`}
                >
                  <p className="text-awk-blue-50">{task.title}</p>
                  <p className="mt-1 text-xs text-awk-blue-400">
                    {task.assigneeName ?? '—'} · vence {task.dueDate}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const fieldClass =
  'w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none';

function NewTaskForm({
  sprintId,
  isAdmin,
  onCancel,
  onCreated
}: {
  sprintId: string;
  isAdmin: boolean;
  onCancel: () => void;
  onCreated: (task: GestorTaskRow) => void;
}) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [users, setUsers] = useState<CoreUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selector "asignar a": reutiliza GET /api/core/users (solo-admin, ya
  // existente) en vez de duplicar una consulta de usuarios dentro de
  // gestor-proyectos (spec-tecnica.md "Reutilización del core"). Solo se
  // pide si el requester es admin — un no-admin siempre se auto-asigna.
  useEffect(() => {
    if (!isAdmin) return;
    apiFetch('/api/core/users', coreUsersResponseSchema)
      .then((rows) => setUsers(rows.filter((u) => u.isActive)))
      .catch(() => setUsers([]));
  }, [isAdmin]);

  async function onSubmit() {
    if (!title.trim() || !dueDate) {
      setError('Título y fecha de vencimiento son obligatorios.');
      return;
    }
    if (isAdmin && !assigneeId) {
      setError('Como admin debes elegir a quién se asigna.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: CreateGestorTaskRequest = {
        sprintId,
        title: title.trim(),
        dueDate,
        assigneeId: isAdmin ? assigneeId : undefined
      };
      const task = await apiFetch('/api/gestor-proyectos/tasks', gestorTaskRowSchema, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      onCreated(task);
    } catch (err) {
      setError(err instanceof ApiError ? `No se pudo crear (HTTP ${err.status}).` : 'No se pudo crear la tarea.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-awk-cyan-700 bg-awk-navy-800 p-4" data-testid="new-task-form">
      <div className={`grid gap-3 ${isAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <div>
          <label className="mb-1 block text-xs text-awk-blue-400">Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs text-awk-blue-400">Vence</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
        </div>
        {isAdmin && (
          <div>
            <label className="mb-1 block text-xs text-awk-blue-400">Asignar a</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={fieldClass}
              data-testid="assignee-select"
            >
              <option value="">Elegir persona…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {!isAdmin && (
        <p className="mt-2 text-xs text-awk-blue-400">Se te asignará automáticamente a ti (no eres admin).</p>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => void onSubmit()} disabled={saving} data-testid="create-task-button">
          {saving ? 'Creando…' : 'Crear tarea'}
        </Button>
      </div>
    </div>
  );
}
