import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@awk/ui';
import { apiFetch } from '../../lib/api';
import { apiDelete } from './focus-flow-api';
import { FocusTaskQueue } from './FocusTaskQueue';
import {
  focusSessionSchema,
  focusSettingsSchema,
  focusTaskSchema,
  focusTasksResponseSchema,
  type CreateFocusSessionRequest,
  type CreateFocusTaskRequest,
  type FocusSessionPhase,
  type FocusSettings,
  type FocusTask,
  type UpdateFocusTaskRequest
} from './focus-flow.types';
import type { FocusSessionInput } from './use-focus-timer';
import { useFocusTimer } from './use-focus-timer';

const RING_RADIUS = 128;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const MODE_LABEL: Record<FocusSessionPhase, string> = {
  focus: 'Enfoque',
  short_break: 'Descanso corto',
  long_break: 'Descanso largo'
};

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function notifyBrowser(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    // Best-effort: un navegador que bloquee Notification no debe romper el timer.
  }
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; settings: FocusSettings; tasks: FocusTask[] };

/**
 * Enfoque: temporizador Pomodoro + cola de hoy (spec-tecnica.md `FocusPage`).
 * Solo se monta el temporizador (`useFocusTimer`) cuando `settings` ya
 * cargó — evita la carrera de "arrancó con 25:00 por defecto y luego saltó
 * a la duración real configurada".
 */
export function FocusPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

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

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold text-white">
          Enfoque <span className="text-awk-cyan-400">·</span> concéntrate un ciclo a la vez
        </h1>
        <p className="mt-2 text-sm text-awk-blue-300">
          El temporizador cuenta en tu navegador; cada fase completada o saltada queda registrada para el
          Dashboard y Desempeño.
        </p>
      </header>

      {state.status === 'loading' && <p className="text-awk-blue-300">Cargando…</p>}
      {state.status === 'error' && (
        <p className="text-red-400" data-testid="focus-error">
          No se pudo cargar el módulo ({state.detail}).
        </p>
      )}
      {state.status === 'ok' && (
        <FocusBody
          settings={state.settings}
          tasks={state.tasks}
          onTasksChanged={(tasks) => setState({ status: 'ok', settings: state.settings, tasks })}
        />
      )}
    </div>
  );
}

function FocusBody({
  settings,
  tasks,
  onTasksChanged
}: {
  settings: FocusSettings;
  tasks: FocusTask[];
  onTasksChanged: (tasks: FocusTask[]) => void;
}) {
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quickAdd, setQuickAdd] = useState('');

  const currentTask = useMemo(() => tasks.find((t) => !t.done) ?? null, [tasks]);

  const showToast = useCallback((title: string, message: string) => {
    setToast({ title, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const reloadTasks = useCallback(() => {
    apiFetch('/api/focus-flow/tasks', focusTasksResponseSchema)
      .then(onTasksChanged)
      .catch(() => undefined);
  }, [onTasksChanged]);

  const onSessionComplete = useCallback(
    (input: FocusSessionInput) => {
      const body: CreateFocusSessionRequest = {
        taskId: input.taskId ?? undefined,
        phase: input.phase,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        durationSeconds: input.durationSeconds,
        wasSkipped: input.wasSkipped
      };

      void apiFetch('/api/focus-flow/sessions', focusSessionSchema, {
        method: 'POST',
        body: JSON.stringify(body)
      })
        .then(() => {
          if (input.phase === 'focus' && input.taskId) reloadTasks();

          if (input.wasSkipped) {
            showToast('Fase saltada', `${MODE_LABEL[input.phase]} saltada.`);
            return;
          }
          if (input.phase === 'focus') {
            showToast('¡Pomodoro completado!', 'Buen trabajo. Es hora de un descanso.');
            notifyBrowser('Pomodoro completado', 'Hora de un descanso.');
          } else {
            showToast('Descanso terminado', 'De vuelta al enfoque.');
            notifyBrowser('Descanso terminado', 'A enfocar de nuevo.');
          }
        })
        .catch(() => showToast('No se pudo registrar', 'La fase terminó pero no se guardó en el servidor.'));
    },
    [reloadTasks, showToast]
  );

  const timer = useFocusTimer({ settings, currentTaskId: currentTask?.id ?? null, onSessionComplete });

  async function onQuickAdd() {
    const title = quickAdd.trim();
    if (!title) return;
    const body: CreateFocusTaskRequest = { title, estimatedPomodoros: 1 };
    const created = await apiFetch('/api/focus-flow/tasks', focusTaskSchema, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    setQuickAdd('');
    onTasksChanged([...tasks, created]);
  }

  async function onToggleDone(task: FocusTask, done: boolean) {
    const body: UpdateFocusTaskRequest = { done };
    const updated = await apiFetch(`/api/focus-flow/tasks/${task.id}`, focusTaskSchema, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
    onTasksChanged(tasks.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function onReorder(taskId: string, newPosition: number) {
    const body: UpdateFocusTaskRequest = { position: newPosition };
    await apiFetch(`/api/focus-flow/tasks/${taskId}`, focusTaskSchema, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
    reloadTasks();
  }

  async function onDelete(task: FocusTask) {
    await apiDelete(`/api/focus-flow/tasks/${task.id}`);
    onTasksChanged(tasks.filter((t) => t.id !== task.id));
  }

  const ringOffset = RING_CIRCUMFERENCE * (1 - timer.remainingSeconds / timer.totalSeconds);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col items-center rounded-2xl border border-awk-blue-800 bg-awk-navy-800 p-8 text-center">
        <div className="mb-6 inline-flex gap-1 rounded-full border border-awk-blue-700 bg-awk-navy-900 p-1">
          {(['focus', 'short_break', 'long_break'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => timer.changeMode(m)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                timer.mode === m ? 'bg-awk-cyan-500 text-awk-navy-900' : 'text-awk-blue-300 hover:text-white'
              }`}
              data-testid={`mode-${m}`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="relative h-[280px] w-[280px]">
          <svg width="280" height="280" viewBox="0 0 280 280" className="-rotate-90">
            <circle cx="140" cy="140" r={RING_RADIUS} fill="none" stroke="#27334f" strokeWidth="14" />
            <circle
              cx="140"
              cy="140"
              r={RING_RADIUS}
              fill="none"
              stroke="#19F7F1"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              style={{ transition: 'stroke-dashoffset .4s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-semibold tabular-nums text-white" data-testid="timer-clock">
              {formatClock(timer.remainingSeconds)}
            </span>
            <span className="mt-1 text-xs font-semibold uppercase tracking-widest text-awk-cyan-300">
              {MODE_LABEL[timer.mode]}
            </span>
            <span className="mt-2 text-xs text-awk-blue-400">
              Ciclo {timer.round} de {settings.roundsBeforeLongBreak}
            </span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={timer.toggleTimer} data-testid="toggle-timer-button">
            {timer.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {timer.running ? 'Pausar' : 'Iniciar'}
          </Button>
          <Button variant="secondary" onClick={timer.resetTimer}>
            <RotateCcw className="h-4 w-4" /> Reiniciar
          </Button>
          <Button variant="ghost" onClick={timer.skipPhase} data-testid="skip-phase-button">
            <SkipForward className="h-4 w-4" /> Saltar
          </Button>
        </div>

        <div className="mt-6 w-full rounded-xl border border-awk-blue-700 bg-awk-navy-900/60 p-4 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-awk-cyan-300">Tarea actual</span>
          {currentTask ? (
            <>
              <p className="mt-1 font-medium text-white">{currentTask.title}</p>
              <p className="text-xs text-awk-blue-400">
                Pomodoro {currentTask.completedPomodoros + 1} de {currentTask.estimatedPomodoros}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-awk-blue-400">Sin tareas pendientes hoy.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-awk-blue-800 bg-awk-navy-800 p-6">
        <h2 className="text-sm font-medium text-awk-blue-100">Cola de hoy</h2>
        <p className="text-xs text-awk-blue-400">Arrastra para reordenar · marca al completar.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onQuickAdd();
            }}
            placeholder="Añadir tarea rápida…"
            className="flex-1 rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none"
            data-testid="quick-add-input"
          />
          <Button size="sm" onClick={() => void onQuickAdd()} data-testid="quick-add-button">
            +
          </Button>
        </div>

        <FocusTaskQueue
          tasks={tasks}
          onToggleDone={(task, done) => void onToggleDone(task, done)}
          onReorder={(taskId, position) => void onReorder(taskId, position)}
          onDelete={(task) => void onDelete(task)}
        />
      </div>

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-awk-cyan-700 bg-awk-navy-800 p-4 shadow-2xl"
          data-testid="focus-toast"
        >
          <p className="text-sm font-semibold text-white">{toast.title}</p>
          <p className="mt-1 text-xs text-awk-blue-300">{toast.message}</p>
        </div>
      )}
    </div>
  );
}
