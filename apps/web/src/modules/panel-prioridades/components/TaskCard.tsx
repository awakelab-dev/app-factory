import { useDraggable } from '@dnd-kit/core';
import { Button } from '@awk/ui';
import type { PanelTask } from '../panel-prioridades.types';

interface TaskCardProps {
  task: PanelTask;
  onClick?: () => void;
  onClose?: (id: string, status: 'done' | 'discarded') => void;
}

export function TaskCard({ task, onClick, onClose }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`p-3 rounded-lg border border-awk-blue-600 bg-awk-blue-900/50 cursor-move transition-opacity ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={onClick}
    >
      <p className="font-medium text-sm text-awk-blue-50 line-clamp-2">{task.title}</p>
      <div className="mt-2 flex items-center gap-1 text-xs text-awk-blue-400">
        {task.overdue && <span className="text-red-400">• Vencida</span>}
        {task.estimatedMinutes && <span>• {task.estimatedMinutes}m</span>}
      </div>

      {onClose && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={e => {
              e.stopPropagation();
              onClose(task.id, 'done');
            }}
          >
            ✓ Hecho
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={e => {
              e.stopPropagation();
              onClose(task.id, 'discarded');
            }}
          >
            ✗ Descartar
          </Button>
        </div>
      )}
    </div>
  );
}
