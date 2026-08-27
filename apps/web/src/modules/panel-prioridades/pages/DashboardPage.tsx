import React, { useEffect, useState } from 'react';
import { listTasks, deleteTask } from '../panel-prioridades-api';
import type { TaskWithOverdue } from '../panel-prioridades.types';
import { Button } from '@awk/ui';

/**
 * DashboardPage: matriz de Eisenhower (4 cuadrantes).
 *
 * Cuadrantes:
 * Q1 (Hacer): urgente + importante (rojo)
 * Q2 (Planificar): no urgente + importante (verde)
 * Q3 (Delegar): urgente + no importante (amarillo)
 * Q4 (Eliminar): no urgente + no importante (gris)
 */
export default function DashboardPage() {
  const [tasks, setTasks] = useState<Map<number, TaskWithOverdue[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listTasks({ status: 'open' });
      const grouped = new Map<number, TaskWithOverdue[]>();
      [1, 2, 3, 4].forEach(q => grouped.set(q, []));
      result.tasks.forEach(task => {
        const q = task.quadrant as 1 | 2 | 3 | 4;
        grouped.get(q)?.push(task);
      });
      setTasks(grouped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tareas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Descartar esta tarea?')) return;
    try {
      await deleteTask(id);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descartar');
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;

  const quadrants = [
    {
      q: 1,
      title: 'Hacer',
      subtitle: 'Urgente e importante',
      color: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      q: 2,
      title: 'Planificar',
      subtitle: 'Importante pero no urgente',
      color: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      q: 3,
      title: 'Delegar',
      subtitle: 'Urgente pero no importante',
      color: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    {
      q: 4,
      title: 'Eliminar',
      subtitle: 'Ni urgente ni importante',
      color: 'bg-gray-50',
      borderColor: 'border-gray-200'
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Panel de Prioridades</h1>
        <Button>Nueva Tarea</Button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {quadrants.map(({ q, title, subtitle, color, borderColor }) => {
          const quadrantTasks = tasks.get(q as 1 | 2 | 3 | 4) || [];
          const sorted = [...quadrantTasks].sort((a, b) => {
            // Tareas vencidas primero
            if (a.overdue && !b.overdue) return -1;
            if (!a.overdue && b.overdue) return 1;
            // Luego por fecha
            if (a.dueDate && b.dueDate) {
              return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            }
            return 0;
          });

          return (
            <div key={q} className={`${color} ${borderColor} border-2 rounded-lg p-6`}>
              <h2 className="text-xl font-bold mb-1">{title}</h2>
              <p className="text-sm text-gray-600 mb-4">{subtitle}</p>
              <div className="space-y-2">
                {sorted.map(task => (
                  <div
                    key={task.id}
                    className="bg-white p-3 rounded border hover:shadow-md transition"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{task.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{task.detail}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {task.overdue && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                              Vencida
                            </span>
                          )}
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {task.origin}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {task.estimatedMinutes}min
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-gray-400 hover:text-red-500 transition"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {sorted.length === 0 && (
                  <p className="text-sm text-gray-500 py-4 text-center">Sin tareas</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
