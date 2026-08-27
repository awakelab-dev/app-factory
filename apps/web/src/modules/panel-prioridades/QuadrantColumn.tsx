import { TaskCard } from './TaskCard';
import type { PanelTask } from './panel-prioridades.types';

interface QuadrantColumnProps {
  quadrant: number;
  tasks: PanelTask[];
  onEditTask: (task: PanelTask) => void;
  onCloseTask: (taskId: string) => void;
  isLoading?: boolean;
}

/**
 * Columna de un cuadrante que lista las tareas ordenadas por vencimiento.
 */
export function QuadrantColumn({
  quadrant,
  tasks,
  onEditTask,
  onCloseTask,
  isLoading
}: QuadrantColumnProps) {
  // Ordenar tareas: primero las vencidas, luego por fecha de vencimiento, luego por creación
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.overdue && !b.overdue) return -1;
    if (!a.overdue && b.overdue) return 1;

    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-16 w-full animate-pulse rounded bg-gray-200" />
        <div className="h-16 w-full animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (sortedTasks.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 p-4 text-center text-gray-500">
        Sin tareas
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedTasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          onEdit={() => onEditTask(task)}
          onClose={() => onCloseTask(task.id)}
        />
      ))}
    </div>
  );
}
