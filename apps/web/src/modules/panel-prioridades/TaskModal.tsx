'use client';

import { useState } from 'react';
import { Button } from '@awk/ui';
import { createPanelTask, updatePanelTask } from './panel-prioridades-api';
import type { PanelTask } from './panel-prioridades.types';

interface TaskModalProps {
  task?: PanelTask | null;
  onClose: () => void;
}

/**
 * Modal para crear o editar una tarea.
 */
export function TaskModal({ task, onClose }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title || '');
  const [detail, setDetail] = useState(task?.detail || '');
  const [urgent, setUrgent] = useState(task?.urgent ?? false);
  const [important, setImportant] = useState(task?.important ?? false);
  const [estimatedMinutes, setEstimatedMinutes] = useState(task?.estimatedMinutes || 60);
  const [origin, setOrigin] = useState(task?.origin || 'self');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [delegatedToName, setDelegatedToName] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('El título es obligatorio');
      return;
    }

    setIsSubmitting(true);
    const data = {
      title,
      detail: detail || null,
      urgent,
      important,
      estimatedMinutes,
      origin: origin as any,
      dueDate: dueDate || null,
      delegatedToName: delegatedToName || null,
      followUpDate: followUpDate || null
    };

    try {
      if (task) {
        await updatePanelTask(task.id, data);
      } else {
        await createPanelTask(data);
      }
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quadrant = (urgent && important && 1) || (!urgent && important && 2) ||
    (urgent && !important && 3) || 4;

  const actionLabels: Record<number, string> = {
    1: 'Hacer — Hazlo ahora',
    2: 'Planificar — Bloquea tiempo',
    3: 'Delegar — Asigna responsable',
    4: 'Eliminar — Descarta esto'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-bold">{task ? 'Editar tarea' : 'Nueva tarea'}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Describe la tarea"
              maxLength={200}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          {/* Detalle */}
          <div>
            <label className="block text-sm font-medium">Detalle</label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Contexto adicional (opcional)"
              maxLength={1000}
              className="mt-1 h-20 w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          {/* Urgencia / Importancia */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">¿Urgente?</label>
              <button
                type="button"
                onClick={() => setUrgent(!urgent)}
                className={`mt-1 w-full rounded px-3 py-2 font-medium ${
                  urgent ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700'
                }`}
              >
                {urgent ? 'Sí' : 'No'}
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium">¿Importante?</label>
              <button
                type="button"
                onClick={() => setImportant(!important)}
                className={`mt-1 w-full rounded px-3 py-2 font-medium ${
                  important ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700'
                }`}
              >
                {important ? 'Sí' : 'No'}
              </button>
            </div>
          </div>

          {/* Cuadrante mostrado */}
          <div className="rounded bg-gray-100 p-3">
            <p className="text-sm font-medium text-gray-700">
              Cuadrante {quadrant}: {actionLabels[quadrant]}
            </p>
          </div>

          {/* Dedicación estimada */}
          <div>
            <label className="block text-sm font-medium">Dedicación (minutos)</label>
            <select
              value={String(estimatedMinutes)}
              onChange={(e) => setEstimatedMinutes(parseInt(e.target.value))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            >
              {[30, 60, 90, 120, 150, 180, 240].map((mins) => (
                <option key={mins} value={String(mins)}>
                  {mins} minutos
                </option>
              ))}
            </select>
          </div>

          {/* Origen */}
          <div>
            <label className="block text-sm font-medium">Origen</label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="meeting">Reunión</option>
              <option value="email">Email</option>
              <option value="chat">Chat</option>
              <option value="self">Iniciativa propia</option>
              <option value="direction">Dirección</option>
            </select>
          </div>

          {/* Fecha límite */}
          <div>
            <label className="block text-sm font-medium">Fecha límite (opcional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          {/* Si es Q3: delegación */}
          {quadrant === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium">Delegar a (opcional)</label>
                <input
                  type="text"
                  value={delegatedToName}
                  onChange={(e) => setDelegatedToName(e.target.value)}
                  placeholder="Nombre del responsable"
                  maxLength={100}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Fecha de seguimiento (opcional)</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>
            </>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {task ? 'Actualizar' : 'Crear'}
            </Button>
            <Button type="button" onClick={onClose} variant="outline">
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
