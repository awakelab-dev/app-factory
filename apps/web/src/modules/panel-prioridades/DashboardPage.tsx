import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Plus, Target, Zap, Clock } from 'lucide-react';
import { Button } from '@awk/ui';
import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext } from '@dnd-kit/core';
import { QuadrantColumn, TaskModal } from './components';
import { useTasks } from './hooks/useTasks';
import { useTeam } from './hooks/useTeam';
import { useSchedule } from './hooks/useSchedule';
import type { PanelTask } from './panel-prioridades.types';

const QUADRANTS = [
  { id: 1, title: 'Hacer', subtitle: 'Urgente + Importante', icon: AlertCircle },
  { id: 2, title: 'Planificar', subtitle: 'Importante', icon: Target },
  { id: 3, title: 'Delegar', subtitle: 'Urgente', icon: Zap },
  { id: 4, title: 'Eliminar', subtitle: 'Ni urgente ni importante', icon: Clock }
];

function computeFromQuadrant(quadrant: number): [boolean, boolean] {
  switch (quadrant) {
    case 1:
      return [true, true];
    case 2:
      return [false, true];
    case 3:
      return [true, false];
    case 4:
    default:
      return [false, false];
  }
}

export function DashboardPage() {
  const { tasks, loading, error, listTasks, createTask, updateTask, closeTask, setDelegation } =
    useTasks();
  const { members, listMembers } = useTeam();
  const { releaseAllBlocksForTask } = useSchedule();

  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PanelTask | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    await listTasks();
    await listMembers();
  }

  async function onRefresh() {
    setSyncing(true);
    await listTasks();
    setSyncing(false);
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newQuadrant = parseInt(over.id as string, 10);
    if (task.quadrant === newQuadrant) return;

    const [newUrgent, newImportant] = computeFromQuadrant(newQuadrant);

    try {
      await updateTask(taskId, {
        urgent: newUrgent,
        important: newImportant
      });

      // Si entra en Q4, liberar bloques
      if (newQuadrant === 4 && task.quadrant !== 4) {
        await releaseAllBlocksForTask(taskId);
      }

      // Si sale de Q3, limpiar delegación
      if (task.quadrant === 3 && newQuadrant !== 3) {
        await setDelegation(taskId, null, null);
      }

      await listTasks();
    } catch (err) {
      console.error('Error moving task:', err);
    }
  };

  const handleOpenModal = (task?: PanelTask) => {
    setSelectedTask(task || null);
    setShowModal(true);
  };

  const handleCloseTask = async (id: string, status: 'done' | 'discarded') => {
    try {
      await closeTask(id, status);
      await listTasks();
    } catch (err) {
      console.error('Error closing task:', err);
    }
  };

  const handleSaveModal = async () => {
    await listTasks();
  };

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
        <div className="flex gap-2">
          <Button onClick={() => handleOpenModal()} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva tarea
          </Button>
          <Button onClick={onRefresh} disabled={syncing} variant="outline">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Actualizando…' : 'Actualizar'}
          </Button>
        </div>
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
        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {tasksByQuadrant.map(q => (
              <QuadrantColumn
                key={q.id}
                id={q.id}
                title={q.title}
                subtitle={q.subtitle}
                icon={q.icon}
                tasks={q.tasks}
                onTaskClick={task => handleOpenModal(task)}
                onTaskClose={handleCloseTask}
              />
            ))}
          </div>
        </DndContext>
      )}

      <TaskModal
        task={selectedTask}
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedTask(null);
        }}
        onSave={handleSaveModal}
        onCreateTask={createTask}
        onUpdateTask={updateTask}
        teamMembers={members}
      />
    </div>
  );
}
