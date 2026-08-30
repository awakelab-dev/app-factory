import { useDraggable } from '@dnd-kit/core';
import type { PanelTask } from '../panel-prioridades.types';

interface UnscheduledPanelProps {
  tasks: PanelTask[];
}

export function UnscheduledPanel({ tasks }: UnscheduledPanelProps) {
  return (
    <div className="rounded-lg border border-awk-blue-700 bg-awk-navy-800 p-4 max-h-screen overflow-y-auto">
      <h3 className="font-semibold text-white mb-4 text-sm">Por agendar ({tasks.length})</h3>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-awk-blue-400 italic">Todo agendado ✓</p>
        ) : (
          tasks.map(task => <UnscheduledTaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}

function UnscheduledTaskCard({ task }: { task: PanelTask }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`p-3 rounded-lg bg-awk-blue-800/40 border border-awk-blue-600 cursor-move transition-opacity ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <p className="text-xs font-medium text-awk-blue-50 line-clamp-1">{task.title}</p>
      <div className="flex justify-between mt-2">
        <span className="text-xs text-awk-blue-400">{task.estimatedMinutes}m</span>
        <span className="text-xs text-awk-blue-400">Q{task.quadrant}</span>
      </div>
    </div>
  );
}
