import type { PanelTask } from './panel-prioridades.types';

interface TaskCardProps {
  task: PanelTask;
  onEdit: () => void;
  onClose: () => void;
}

/**
 * Tarjeta de tarea individual arrastrable.
 * Muestra título, vencimiento, origen y botones de acción.
 */
export function TaskCard({ task, onEdit, onClose }: TaskCardProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysUntil = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil === 0) return 'Hoy';
    if (daysUntil === 1) return 'Mañana';
    if (daysUntil > 1 && daysUntil <= 7) return `En ${daysUntil}d`;

    return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
  };

  const originLabels: Record<string, string> = {
    meeting: '📞 Reunión',
    email: '📧 Email',
    chat: '💬 Chat',
    self: '💡 Iniciativa',
    direction: '🎯 Dirección'
  };

  return (
    <div className="cursor-grab rounded-lg border border-gray-200 bg-white p-3 hover:shadow-md active:cursor-grabbing">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-sm">{task.title}</p>
          {task.detail && <p className="text-xs text-gray-600 line-clamp-2">{task.detail}</p>}
        </div>
        <button
          onClick={onClose}
          className="ml-2 text-gray-400 hover:text-red-600"
          title="Marcar como hecha"
        >
          ✓
        </button>
      </div>

      <div className="mb-2 flex gap-2">
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {task.estimatedMinutes}min
        </span>
        {task.overdue && (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            Vencida
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-gray-600">
          {originLabels[task.origin] || task.origin}
          {task.dueDate && <span>• {formatDate(task.dueDate)}</span>}
        </div>
        <button
          onClick={onEdit}
          className="text-xs text-blue-600 hover:underline"
          title="Editar tarea"
        >
          Editar
        </button>
      </div>
    </div>
  );
}
