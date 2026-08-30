import { useDroppable } from '@dnd-kit/core';
import type { LucideIcon } from 'lucide-react';
import { TaskCard } from './TaskCard';
import type { PanelTask } from '../panel-prioridades.types';

interface QuadrantColumnProps {
  id: number;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tasks: PanelTask[];
  onTaskClick?: (task: PanelTask) => void;
  onTaskClose?: (id: string, status: 'done' | 'discarded') => void;
}

export function QuadrantColumn({
  id,
  title,
  subtitle,
  icon: Icon,
  tasks,
  onTaskClick,
  onTaskClose
}: QuadrantColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: String(id)
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-awk-blue-700 p-4 min-h-96 transition-colors ${
        isOver ? 'bg-awk-blue-800/60 border-awk-cyan-400' : 'bg-awk-navy-800'
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-awk-cyan-400" />
        <div>
          <h3 className="font-semibold text-white text-sm">{title}</h3>
          <p className="text-xs text-awk-blue-400">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-awk-blue-500 italic">Sin tareas</p>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
              onClose={onTaskClose}
            />
          ))
        )}
      </div>
    </div>
  );
}
