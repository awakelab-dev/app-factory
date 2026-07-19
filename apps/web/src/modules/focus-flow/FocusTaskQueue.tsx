import { useState } from 'react';
import type { DragEvent } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import type { FocusTask } from './focus-flow.types';

/**
 * Cola de tareas del día — compartida entre `FocusPage` (compacta) y
 * `TasksPage` (planificación completa). Arrastrar-y-soltar con la API
 * nativa HTML5 Drag and Drop (gate técnico, decisión 5 — sin `dnd-kit`),
 * mismo criterio que el kanban de `gestor-proyectos`: el `drop` solo dispara
 * `onReorder(taskId, index)`, quien decide qué hacer (aquí no hay permisos
 * por fila que revalidar — es siempre la cola del propio usuario).
 */
export function FocusTaskQueue({
  tasks,
  onToggleDone,
  onReorder,
  onDelete
}: {
  tasks: FocusTask[];
  onToggleDone: (task: FocusTask, done: boolean) => void;
  onReorder: (taskId: string, newPosition: number) => void;
  onDelete: (task: FocusTask) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function handleDrop(e: DragEvent<HTMLLIElement>, targetIndex: number) {
    e.preventDefault();
    setDragOverId(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onReorder(taskId, targetIndex);
  }

  if (tasks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-awk-blue-700 p-6 text-center text-sm text-awk-blue-400" data-testid="focus-queue-empty">
        Sin tareas para hoy — añade la primera.
      </p>
    );
  }

  return (
    <ul className="mt-2 flex flex-col gap-2" data-testid="focus-queue">
      {tasks.map((task, index) => (
        <li
          key={task.id}
          draggable
          onDragStart={(e) => {
            setDragId(task.id);
            e.dataTransfer.setData('text/plain', task.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => setDragId(null)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId(task.id);
          }}
          onDragLeave={() => setDragOverId((id) => (id === task.id ? null : id))}
          onDrop={(e) => handleDrop(e, index)}
          className={`flex items-center gap-3 rounded-xl border bg-awk-navy-800/60 p-3 transition-colors ${
            dragOverId === task.id ? 'border-awk-cyan-500' : 'border-awk-blue-700'
          } ${dragId === task.id ? 'opacity-40' : ''} ${task.done ? 'opacity-60' : ''}`}
          data-testid={`focus-task-${task.id}`}
        >
          <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-awk-blue-500" />
          <input
            type="checkbox"
            checked={task.done}
            onChange={(e) => onToggleDone(task, e.target.checked)}
            className="h-5 w-5 flex-shrink-0 accent-awk-cyan-400"
            data-testid={`focus-task-done-${task.id}`}
          />
          <div className="min-w-0 flex-1">
            <p className={`text-sm text-awk-blue-50 ${task.done ? 'line-through' : ''}`}>{task.title}</p>
            <div className="mt-1 flex items-center gap-2">
              <PomodoroDots done={task.completedPomodoros} total={task.estimatedPomodoros} />
              <span className="text-xs text-awk-blue-400">
                {task.completedPomodoros}/{task.estimatedPomodoros} pomodoros
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDelete(task)}
            className="flex-shrink-0 text-awk-blue-500 hover:text-red-400"
            title="Eliminar tarea"
            data-testid={`focus-task-delete-${task.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function PomodoroDots({ done, total }: { done: number; total: number }) {
  return (
    <span className="flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i < done ? 'bg-awk-cyan-400' : 'bg-awk-blue-700'}`}
        />
      ))}
    </span>
  );
}
