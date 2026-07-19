import { useCallback, useEffect, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { Button } from '@awk/ui';
import { apiFetch } from '../../lib/api';
import { apiDelete } from './focus-flow-api';
import { FocusTaskQueue } from './FocusTaskQueue';
import {
  focusSettingsSchema,
  focusTaskSchema,
  focusTasksResponseSchema,
  importFocusTasksResponseSchema,
  type CreateFocusTaskRequest,
  type FocusSettings,
  type FocusTask,
  type UpdateFocusTaskRequest
} from './focus-flow.types';

type PageState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; settings: FocusSettings; tasks: FocusTask[] };

/**
 * Planificación del día (spec-tecnica.md `TasksPage`): la misma cola de
 * `FocusPage` con más detalle — alta con estimado de pomodoros, resumen,
 * estimación de cierre y "Importar mis tareas asignadas" (gate funcional,
 * decisión 2: copia de solo lectura desde `gestor-proyectos`, nunca una
 * referencia viva).
 */
export function TasksPage() {
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      apiFetch('/api/focus-flow/settings', focusSettingsSchema),
      apiFetch('/api/focus-flow/tasks', focusTasksResponseSchema)
    ])
      .then(([settings, tasks]) => setState({ status: 'ok', settings, tasks }))
      .catch((err: unknown) =>
        setState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, []);

  useEffect(load, [load]);

  function setTasks(tasks: FocusTask[]) {
    setState((prev) => (prev.status === 'ok' ? { ...prev, tasks } : prev));
  }

  async function onImport() {
    setImporting(true);
    setImportMessage(null);
    try {
      const result = await apiFetch('/api/focus-flow/tasks/import-from-proyectos', importFocusTasksResponseSchema, {
        method: 'POST'
      });
      if (state.status === 'ok') setTasks([...state.tasks, ...result.imported]);
      setImportMessage(
        result.imported.length === 0
          ? `Nada nuevo que importar${result.skippedAlreadyImported > 0 ? ' (ya estaban en tu cola).' : '.'}`
          : `Importadas ${result.imported.length} tarea(s)${result.skippedAlreadyImported > 0 ? ` · ${result.skippedAlreadyImported} ya estaban importadas` : ''}.`
      );
    } catch {
      setImportMessage('No se pudo importar desde Gestor de Proyectos.');
    } finally {
      setImporting(false);
    }
  }

  async function onToggleDone(task: FocusTask, done: boolean) {
    if (state.status !== 'ok') return;
    const body: UpdateFocusTaskRequest = { done };
    const updated = await apiFetch(`/api/focus-flow/tasks/${task.id}`, focusTaskSchema, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
    setTasks(state.tasks.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function onReorder(taskId: string, newPosition: number) {
    const body: UpdateFocusTaskRequest = { position: newPosition };
    await apiFetch(`/api/focus-flow/tasks/${taskId}`, focusTaskSchema, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
    load();
  }

  async function onDelete(task: FocusTask) {
    if (state.status !== 'ok') return;
    await apiDelete(`/api/focus-flow/tasks/${task.id}`);
    setTasks(state.tasks.filter((t) => t.id !== task.id));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold text-white">
            Tareas del día <span className="text-awk-cyan-400">·</span> planifica tu jornada
          </h1>
          <p className="mt-2 text-sm text-awk-blue-300">
            Ordena por prioridad y estima pomodoros por tarea. La cola persiste entre sesiones y dispositivos.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void onImport()} disabled={importing} data-testid="import-button">
          <Download className="h-4 w-4" /> {importing ? 'Importando…' : 'Importar mis tareas asignadas'}
        </Button>
      </header>

      {importMessage && <p className="text-sm text-awk-cyan-300">{importMessage}</p>}

      {state.status === 'loading' && <p className="text-awk-blue-300">Cargando…</p>}
      {state.status === 'error' && (
        <p className="text-red-400" data-testid="tasks-error">
          No se pudo cargar la planificación ({state.detail}).
        </p>
      )}

      {state.status === 'ok' && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-awk-blue-800 bg-awk-navy-800 p-6">
            <h2 className="text-sm font-medium text-awk-blue-100">Planificación del día</h2>
            <p className="text-xs text-awk-blue-400">Nueva tarea con su estimado de pomodoros.</p>
            <NewTaskForm onCreated={(task) => setTasks([...state.tasks, task])} />
            <FocusTaskQueue
              tasks={state.tasks}
              onToggleDone={(task, done) => void onToggleDone(task, done)}
              onReorder={(taskId, position) => void onReorder(taskId, position)}
              onDelete={(task) => void onDelete(task)}
            />
          </div>

          <div className="flex flex-col gap-4">
            <EstimatedFinishCard settings={state.settings} tasks={state.tasks} />
            <SummaryCard tasks={state.tasks} />
          </div>
        </div>
      )}
    </div>
  );
}

function NewTaskForm({ onCreated }: { onCreated: (task: FocusTask) => void }) {
  const [title, setTitle] = useState('');
  const [estimatedPomodoros, setEstimatedPomodoros] = useState(2);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const body: CreateFocusTaskRequest = { title: trimmed, estimatedPomodoros };
      const created = await apiFetch('/api/focus-flow/tasks', focusTaskSchema, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      onCreated(created);
      setTitle('');
      setEstimatedPomodoros(2);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        placeholder="Nueva tarea…"
        className="min-w-0 flex-1 rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none"
        data-testid="new-task-title-input"
      />
      <div className="flex items-center gap-1 rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-2">
        <button
          type="button"
          onClick={() => setEstimatedPomodoros((v) => Math.max(1, v - 1))}
          className="px-2 text-awk-cyan-300"
        >
          −
        </button>
        <span className="w-6 text-center text-sm text-awk-blue-50" data-testid="new-task-estimate">
          {estimatedPomodoros}
        </span>
        <button
          type="button"
          onClick={() => setEstimatedPomodoros((v) => Math.min(20, v + 1))}
          className="px-2 text-awk-cyan-300"
        >
          +
        </button>
      </div>
      <Button size="sm" onClick={() => void submit()} disabled={saving} data-testid="new-task-submit">
        <Plus className="h-4 w-4" /> Añadir
      </Button>
    </div>
  );
}

function SummaryCard({ tasks }: { tasks: FocusTask[] }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const usedPomodoros = tasks.reduce((acc, t) => acc + t.completedPomodoros, 0);
  const estimatedPomodoros = tasks.reduce((acc, t) => acc + t.estimatedPomodoros, 0);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="rounded-2xl border border-awk-blue-800 bg-awk-navy-800 p-5">
      <h3 className="text-sm font-medium text-awk-blue-100">Resumen</h3>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-awk-blue-400">Planificadas hoy</dt>
          <dd className="font-semibold text-white">{total} tareas</dd>
        </div>
        <div>
          <dt className="text-awk-blue-400">Completadas</dt>
          <dd className="font-semibold text-white">
            {done} ({pct}% del día)
          </dd>
        </div>
        <div>
          <dt className="text-awk-blue-400">Pomodoros consumidos</dt>
          <dd className="font-semibold text-white">
            {usedPomodoros} / {estimatedPomodoros}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function EstimatedFinishCard({ settings, tasks }: { settings: FocusSettings; tasks: FocusTask[] }) {
  const pending = tasks.filter((t) => !t.done);
  const remainingPomodoros = pending.reduce(
    (acc, t) => acc + Math.max(0, t.estimatedPomodoros - t.completedPomodoros),
    0
  );
  // Estimación simple (spec-tecnica.md prototipo): pomodoros restantes por su
  // duración + un descanso corto entre cada uno — no modela descansos largos
  // ni pausas manuales, es una proyección orientativa, no un compromiso.
  const minutesRemaining =
    remainingPomodoros * settings.focusMinutes + Math.max(0, remainingPomodoros - 1) * settings.shortBreakMinutes;
  const finish = new Date(Date.now() + minutesRemaining * 60_000);
  const finishLabel = finish.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const hours = Math.floor(minutesRemaining / 60);
  const minutes = minutesRemaining % 60;

  return (
    <div className="rounded-2xl border border-awk-cyan-700 bg-gradient-to-br from-awk-navy-700 to-awk-navy-900 p-5">
      <h3 className="text-sm font-medium text-awk-blue-100">Estimación de cierre</h3>
      <p className="text-xs text-awk-blue-400">Hora estimada de finalización</p>
      <p className="mt-2 text-3xl font-semibold text-awk-cyan-300" data-testid="estimated-finish">
        {remainingPomodoros === 0 ? '—' : finishLabel}
      </p>
      <p className="mt-2 text-xs text-awk-blue-400">
        {remainingPomodoros === 0
          ? 'Sin pomodoros pendientes.'
          : `Quedan ${remainingPomodoros} pomodoros · ~${hours > 0 ? `${hours}h ` : ''}${minutes}m`}
      </p>
    </div>
  );
}
