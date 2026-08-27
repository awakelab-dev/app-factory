'use client';

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@awk/ui';
import { listPanelTasks, deletePanelTask } from './panel-prioridades-api';
import { TaskModal } from './TaskModal';
import { QuadrantColumn } from './QuadrantColumn';
import type { PanelTask } from './panel-prioridades.types';

/**
 * DashboardPage: matriz de Eisenhower (4 cuadrantes).
 * Vista principal que clasifica tareas por urgencia/importancia.
 */
export function DashboardPage() {
  const [tasks, setTasks] = useState<PanelTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PanelTask | null>(null);

  useEffect(() => {
    listPanelTasks({ status: 'open' })
      .then(setTasks)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  const quadrantLabels = [
    { quadrant: 1, label: 'Hacer', description: 'Urgente e Importante', color: 'bg-red-50' },
    { quadrant: 2, label: 'Planificar', description: 'Importante (no urgente)', color: 'bg-green-50' },
    { quadrant: 3, label: 'Delegar', description: 'Urgente (no importante)', color: 'bg-yellow-50' },
    { quadrant: 4, label: 'Eliminar', description: 'Ni urgente ni importante', color: 'bg-gray-50' }
  ];

  const handleOpenModal = () => {
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const handleEditTask = (task: PanelTask) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleCloseTask = async (taskId: string) => {
    await deletePanelTask(taskId, 'done');
    // Reload tasks
    listPanelTasks({ status: 'open' }).then(setTasks).catch(() => {});
  };

  if (error) {
    return <div className="p-4 text-red-600">Error al cargar tareas: {error.message}</div>;
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel de Prioridades</h1>
          <p className="text-gray-600">Matriz de Eisenhower: Clasifica tus tareas</p>
        </div>
        <div className="flex gap-2">
          <Link to="/panel-prioridades/week">
            <Button variant="outline">Ver Semana</Button>
          </Link>
          <Link to="/panel-prioridades/delegations">
            <Button variant="outline">Delegaciones</Button>
          </Link>
          <Link to="/panel-prioridades/metrics">
            <Button variant="outline">Indicadores</Button>
          </Link>
          <Link to="/panel-prioridades/team">
            <Button variant="outline">Equipo</Button>
          </Link>
          <Button onClick={handleOpenModal}>Crear Tarea</Button>
        </div>
      </div>

      {/* Matriz de 4 cuadrantes */}
      <div className="grid grid-cols-2 gap-4">
        {quadrantLabels.map(({ quadrant, label, description, color }) => (
          <div key={quadrant} className={`rounded-lg border p-4 ${color}`}>
            <div className="mb-3">
              <h2 className="font-bold text-lg">{label}</h2>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
            <QuadrantColumn
              quadrant={quadrant}
              tasks={tasks.filter(t => t.quadrant === quadrant)}
              onEditTask={handleEditTask}
              onCloseTask={handleCloseTask}
              isLoading={isLoading}
            />
          </div>
        ))}
      </div>

      {/* Modal de crear/editar tarea */}
      {isModalOpen && (
        <TaskModal
          task={selectedTask}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}
