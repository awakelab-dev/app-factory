import React, { useEffect, useState } from 'react';
import { listTasks } from '../panel-prioridades-api';
import type { TaskWithOverdue } from '../panel-prioridades.types';

/**
 * DelegationsPage: tabla de tareas delegadas (Q3: urgente no importante).
 */
export default function DelegationsPage() {
  const [delegations, setDelegations] = useState<TaskWithOverdue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDelegations();
  }, []);

  const loadDelegations = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listTasks({ quadrant: 3, status: 'open' });
      setDelegations(result.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar delegaciones');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Delegaciones</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-4 text-left">Tarea</th>
              <th className="p-4 text-left">Responsable</th>
              <th className="p-4 text-left">Seguimiento</th>
              <th className="p-4 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {delegations.map(task => (
              <tr key={task.id} className="border-b hover:bg-gray-50">
                <td className="p-4">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-gray-600">{task.detail}</p>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    Sin asignar
                  </span>
                </td>
                <td className="p-4">
                  {task.dueDate && (
                    <span className="text-sm">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                    Pendiente
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {delegations.length === 0 && (
        <div className="p-8 text-center text-gray-500 border rounded-lg">
          <p>Sin delegaciones pendientes</p>
        </div>
      )}
    </div>
  );
}
