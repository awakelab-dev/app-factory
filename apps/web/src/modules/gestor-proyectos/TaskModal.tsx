import { useEffect, useState } from 'react';
import { coreUsersResponseSchema, type CoreUser } from '@awk/types';
import { Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@awk/ui';
import { ApiError, apiFetch } from '../../lib/api';
import { apiDelete } from './gestor-proyectos-api';
import {
  gestorSubtaskSchema,
  gestorTaskRowSchema,
  gestorCommentSchema,
  type GestorTaskRow,
  type ProyectosTaskStatus,
  type UpdateGestorTaskRequest
} from './gestor-proyectos.types';
import { TASK_STATUS_COLUMNS, TASK_STATUS_LABEL } from './task-status-labels';

const fieldClass =
  'w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none';

/**
 * Modal de detalle/edición de una tarea (spec-tecnica.md): estado, edición
 * de título/fecha/asignado, subtareas, comentarios, eliminar — cada acción
 * muestra su control SOLO si `task.permissions` lo permite, pero el backend
 * es quien de verdad decide (esto es UX, no el control de seguridad).
 */
export function TaskModal({
  task: initialTask,
  onClose,
  onChanged,
  onDeleted
}: {
  task: GestorTaskRow;
  onClose: () => void;
  onChanged: (task: GestorTaskRow) => void;
  onDeleted: (taskId: string) => void;
}) {
  const [task, setTask] = useState(initialTask);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function apply(updated: GestorTaskRow) {
    setTask(updated);
    onChanged(updated);
  }

  async function onStatusChange(status: ProyectosTaskStatus) {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch(`/api/gestor-proyectos/tasks/${task.id}/status`, gestorTaskRowSchema, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      apply(updated);
    } catch {
      setError('No se pudo cambiar el estado.');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!window.confirm('¿Eliminar esta tarea? Se borran también sus subtareas y comentarios.')) return;
    setBusy(true);
    try {
      await apiDelete(`/api/gestor-proyectos/tasks/${task.id}`);
      onDeleted(task.id);
    } catch {
      setError('No se pudo eliminar la tarea.');
      setBusy(false);
    }
  }

  async function onToggleSubtask(subtaskId: string, done: boolean) {
    try {
      const updatedSubtask = await apiFetch(`/api/gestor-proyectos/subtasks/${subtaskId}`, gestorSubtaskSchema, {
        method: 'PATCH',
        body: JSON.stringify({ done })
      });
      apply({ ...task, subtasks: task.subtasks.map((s) => (s.id === subtaskId ? updatedSubtask : s)) });
    } catch {
      setError('No se pudo actualizar la subtarea.');
    }
  }

  async function onAddSubtask(title: string) {
    const created = await apiFetch(`/api/gestor-proyectos/tasks/${task.id}/subtasks`, gestorSubtaskSchema, {
      method: 'POST',
      body: JSON.stringify({ title })
    });
    apply({ ...task, subtasks: [...task.subtasks, created] });
  }

  async function onAddComment(text: string) {
    const created = await apiFetch(`/api/gestor-proyectos/tasks/${task.id}/comments`, gestorCommentSchema, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    apply({ ...task, comments: [...task.comments, created] });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      data-testid="task-modal-backdrop"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="task-modal"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{task.title}</h2>
            <p className="mt-1 text-xs text-awk-blue-400">
              {task.assigneeName ?? '—'} · vence {task.dueDate}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-awk-blue-400 hover:text-awk-blue-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-xs text-awk-blue-400">Estado</label>
          <select
            value={task.status}
            disabled={!task.permissions.canChangeStatus || busy}
            onChange={(e) => void onStatusChange(e.target.value as ProyectosTaskStatus)}
            className={fieldClass}
            data-testid="task-status-select"
          >
            {TASK_STATUS_COLUMNS.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABEL[status]}
              </option>
            ))}
          </select>

          {task.permissions.canEditTask && (
            <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          )}
          {task.permissions.canDeleteTask && (
            <Button variant="ghost" size="sm" onClick={() => void onDelete()} disabled={busy} data-testid="delete-task-button">
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          )}
        </div>

        {editing && (
          <EditTaskForm
            task={task}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              apply(updated);
              setEditing(false);
            }}
          />
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <SubtasksSection
          subtasks={task.subtasks}
          canAddInfo={task.permissions.canAddInfo}
          onToggle={onToggleSubtask}
          onAdd={onAddSubtask}
        />

        <CommentsSection comments={task.comments} canAddInfo={task.permissions.canAddInfo} onAdd={onAddComment} />
      </div>
    </div>
  );
}

function EditTaskForm({
  task,
  onCancel,
  onSaved
}: {
  task: GestorTaskRow;
  onCancel: () => void;
  onSaved: (task: GestorTaskRow) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId);
  const [users, setUsers] = useState<CoreUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/core/users', coreUsersResponseSchema)
      .then((rows) => setUsers(rows.filter((u) => u.isActive)))
      .catch(() => setUsers([]));
  }, []);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const patch: UpdateGestorTaskRequest = { title, dueDate, assigneeId };
      const updated = await apiFetch(`/api/gestor-proyectos/tasks/${task.id}`, gestorTaskRowSchema, {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? `No se pudo guardar (HTTP ${err.status}).` : 'No se pudo guardar el cambio.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-awk-cyan-700 p-3" data-testid="edit-task-form">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-awk-blue-400">Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-awk-blue-400">Vence</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-awk-blue-400">Asignado a</label>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={fieldClass}>
            {!users.some((u) => u.id === assigneeId) && <option value={assigneeId}>{assigneeId}</option>}
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => void onSave()} disabled={saving} data-testid="save-task-button">
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}

function SubtasksSection({
  subtasks,
  canAddInfo,
  onToggle,
  onAdd
}: {
  subtasks: GestorTaskRow['subtasks'];
  canAddInfo: boolean;
  onToggle: (id: string, done: boolean) => void;
  onAdd: (title: string) => Promise<void>;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  async function submit() {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await onAdd(newTitle.trim());
      setNewTitle('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-awk-blue-100">Subtareas ({subtasks.length})</h3>
      <ul className="mt-2 space-y-1" data-testid="subtasks-list">
        {subtasks.map((subtask) => (
          <li key={subtask.id} className="flex items-center gap-2 text-sm text-awk-blue-200">
            <input
              type="checkbox"
              checked={subtask.done}
              disabled={!canAddInfo}
              onChange={(e) => onToggle(subtask.id, e.target.checked)}
            />
            <span className={subtask.done ? 'text-awk-blue-500 line-through' : ''}>{subtask.title}</span>
          </li>
        ))}
      </ul>
      {canAddInfo && (
        <div className="mt-2 flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nueva subtarea…"
            className={fieldClass}
            data-testid="new-subtask-input"
          />
          <Button size="sm" onClick={() => void submit()} disabled={adding}>
            Añadir
          </Button>
        </div>
      )}
    </div>
  );
}

function CommentsSection({
  comments,
  canAddInfo,
  onAdd
}: {
  comments: GestorTaskRow['comments'];
  canAddInfo: boolean;
  onAdd: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setAdding(true);
    try {
      await onAdd(text.trim());
      setText('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-awk-blue-100">Comentarios ({comments.length})</h3>
      <ul className="mt-2 space-y-2" data-testid="comments-list">
        {comments.map((comment) => (
          <li key={comment.id} className="rounded-lg bg-awk-navy-900 p-2 text-sm">
            <p className="text-awk-blue-50">{comment.text}</p>
            <p className="mt-1 text-xs text-awk-blue-500">
              {comment.authorName ?? '—'} · {new Date(comment.createdAt).toLocaleString('es-ES')}
            </p>
          </li>
        ))}
      </ul>
      {canAddInfo && (
        <div className="mt-2 flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Añadir comentario…"
            className={fieldClass}
            data-testid="new-comment-input"
          />
          <Button size="sm" onClick={() => void submit()} disabled={adding}>
            Comentar
          </Button>
        </div>
      )}
    </div>
  );
}
