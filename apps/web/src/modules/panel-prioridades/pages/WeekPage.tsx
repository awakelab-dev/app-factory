import React, { useEffect, useState } from 'react';
import { getScheduleGrid, toggleScheduleBlock } from '../panel-prioridades-api';
import type { ScheduleGrid } from '../panel-prioridades.types';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 8-17

/**
 * WeekPage: vista de time-blocking (lunes-viernes, 8-17).
 * Matriz día × hora con tareas agendadas.
 */
export default function WeekPage() {
  const [grid, setGrid] = useState<ScheduleGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const gridData = await getScheduleGrid();
      setGrid(gridData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async (day: number, hour: number) => {
    if (!grid) return;
    const existing = grid.blocks.find(b => b.dayOfWeek === day && b.hour === hour);
    try {
      await toggleScheduleBlock('dummy', day, hour, existing?.taskId ? null : undefined);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Semana de Trabajo (Time-blocking)</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Hora</th>
              {DAYS.map(day => (
                <th key={day} className="border p-2 text-center font-semibold">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour}>
                <td className="border p-2 font-semibold text-sm bg-gray-50">{hour}:00</td>
                {DAYS.map((_, dayIndex) => {
                  const block = grid?.blocks.find(
                    b => b.dayOfWeek === dayIndex && b.hour === hour
                  );
                  return (
                    <td
                      key={`${dayIndex}-${hour}`}
                      className={`border p-2 cursor-pointer hover:bg-blue-50 transition ${
                        block?.taskId ? 'bg-blue-100' : ''
                      }`}
                      onClick={() => handleToggleBlock(dayIndex, hour)}
                    >
                      <div className="text-sm">
                        {block?.taskTitle ? (
                          <div className="bg-blue-500 text-white p-1 rounded text-xs">
                            {block.taskTitle}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-center">—</div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-gray-600">
        Haz clic en una franja para agendar una tarea. Solo Q1 y Q2 pueden agendarse.
      </p>
    </div>
  );
}
