import { useEffect, useState } from 'react';
import { AlertCircle, Clock, RefreshCw, Target, Zap } from 'lucide-react';
import { Button } from '@awk/ui';
import { apiFetch } from '../../lib/api';
import type { PanelTask } from './panel-prioridades.types';
import { panelTaskSchema } from './panel-prioridades.types';
import { z } from 'zod';

const QUADRANTS = [
  { id: 1, title: 'Hacer', subtitle: 'Urgente + Importante', color: 'awk-red', icon: AlertCircle },
  { id: 2, title: 'Planificar', subtitle: 'Importante', color: 'awk-cyan', icon: Target },
  { id: 3, title: 'Delegar', subtitle: 'Urgente', color: 'awk-yellow', icon: Zap },
  { id: 4, title: 'Eliminar', subtitle: 'Ni urgente ni importante', color: 'awk-gray', icon: Clock }
];

const panelTasksListSchema = z.array(panelTaskSchema);

export function DashboardPage() {
  const [tasks, setTasks] = useState<PanelTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch('/api/panel-prioridades/tasks', panelTasksListSchema);
      setTasks(response || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tareas');
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setSyncing(true);
    await loadTasks();
    setSyncing(false);
  }

  const tasksByQuadrant = QUADRANTS.map(q => ({
    ...q,
    tasks: tasks.filter(t => t.quadrant === q.id)
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">
            Panel de Prioridades <span className="text-awk-cyan-400">·</span> matriz
          </h1>
          <p className="mt-2 text-sm text-awk-blue-300">
            Matriz de Eisenhower: clasifica tus tareas por urgencia e importancia
          </p>
        </div>
        <Button onClick={onRefresh} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-800 bg-red-900/20 p-4">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-awk-blue-300">Cargando tareas…</p>
      ) : (
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {tasksByQuadrant.map(q => {
            const Icon = q.icon;
            return (
              <div key={q.id} className="rounded-lg border border-awk-blue-700 bg-awk-navy-800 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-awk-cyan-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">{q.title}</p>
                    <p className="text-xs text-awk-blue-400">{q.subtitle}</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-awk-cyan-400">{q.tasks.length}</p>
                <div className="mt-4 max-h-60 space-y-2 overflow-y-auto">
                  {q.tasks.map(task => (
                    <div
                      key={task.id}
                      className="rounded-lg bg-awk-blue-800/40 p-2 text-xs border border-awk-blue-700"
                    >
                      <p className="text-awk-blue-50 line-clamp-2">{task.title}</p>
                      <div className="mt-1 flex items-center gap-1 text-awk-blue-400">
                        {task.overdue && <span className="text-red-400">•Vencida</span>}
                        {task.estimatedMinutes && <span>• {task.estimatedMinutes}m</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
