import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext } from '@dnd-kit/core';
import { ScheduleGrid, UnscheduledPanel } from './components';
import { useTasks } from './hooks/useTasks';
import { useSchedule } from './hooks/useSchedule';

export function WeekPage() {
  const { tasks, listTasks } = useTasks();
  const { schedule, loading, loadSchedule, reserveBlock, releaseBlock } = useSchedule();
  const [releasing, setReleasing] = useState<{ day: number; hour: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    await listTasks({ quadrant: 1 });
    await listTasks({ quadrant: 2 });
    await loadSchedule();
  }

  // Tareas Q1 y Q2 que NO tienen bloque agendado
  const unscheduledTasks = tasks.filter(t => {
    const hasBlock = schedule?.some(day =>
      day.blocks.some(block => block.taskId === t.id && block.hour)
    );
    return (t.quadrant === 1 || t.quadrant === 2) && t.status === 'open' && !hasBlock;
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);

    // Validar Q1/Q2
    if (!task || task.quadrant === 3 || task.quadrant === 4) {
      setError('Solo Q1 y Q2 pueden ser agendadas');
      return;
    }

    // over.id formato: "0-8" (day-hour)
    const overIdStr = String(over.id);
    const parts = overIdStr.split('-');
    if (parts.length !== 2) {
      setError('Coordenadas inválidas');
      return;
    }
    const day = parseInt(parts[0] ?? '', 10);
    const hour = parseInt(parts[1] ?? '', 10);

    if (isNaN(day) || isNaN(hour)) {
      setError('Coordenadas inválidas');
      return;
    }

    try {
      await reserveBlock(taskId, day, hour);
      setError(null);
    } catch (err) {
      setError('Error al agendar: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    }
  };

  const handleReleaseBlock = async (day: number, hour: number) => {
    setReleasing({ day, hour });
    try {
      await releaseBlock(day, hour);
      setError(null);
    } catch (err) {
      setError('Error al liberar: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setReleasing(null);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white">
          Panel de Prioridades <span className="text-awk-cyan-400">·</span> semana
        </h1>
        <p className="mt-2 text-sm text-awk-blue-300">
          Time-blocking: arrastra tareas para reservar bloques de tiempo
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-800 bg-red-900/20 p-4">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-awk-blue-300">Cargando agenda…</p>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-4 gap-6">
            <UnscheduledPanel tasks={unscheduledTasks} />
            <div className="col-span-3">
              <ScheduleGrid
                schedule={schedule ?? undefined}
                onReleaseBlock={handleReleaseBlock}
              />
            </div>
          </div>
        </DndContext>
      )}

      {releasing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-awk-navy-800 rounded-lg p-4 border border-awk-blue-700">
            <p className="text-awk-blue-100">Liberando bloque…</p>
          </div>
        </div>
      )}
    </div>
  );
}
