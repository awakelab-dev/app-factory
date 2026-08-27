'use client';

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@awk/ui';
import { getWeekSchedule, reserveBlock, releaseBlock } from './panel-prioridades-api';
import { listPanelTasks } from './panel-prioridades-api';
import type { ScheduleWeek, PanelTask } from './panel-prioridades.types';

/**
 * WeekPage: vista de bloques de tiempo semanal (lunes–viernes, 8–17).
 * Time-blocking grid para reservar dedicación en tareas del Q2 principalmente.
 */
export function WeekPage() {
  const [schedule, setSchedule] = useState<ScheduleWeek>([]);
  const [tasks, setTasks] = useState<PanelTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getWeekSchedule(), listPanelTasks({ status: 'open' })])
      .then(([sched, taskList]) => {
        setSchedule(sched);
        setTasks(taskList);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const hours = Array.from({ length: 10 }, (_, i) => i + 8); // 8–17

  const handleRelease = async (day: number, hour: number) => {
    try {
      await releaseBlock(day, hour);
      // Reload schedule
      const sched = await getWeekSchedule();
      setSchedule(sched);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getTaskTitle = (taskId: string | null) => {
    if (!taskId) return null;
    const task = tasks.find(t => t.id === taskId);
    return task?.title || '(Tarea eliminada)';
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Semana Agendada</h1>
          <p className="text-gray-600">Bloquea tiempo para el Q2 (importante-no-urgente)</p>
        </div>
        <Link to="/panel-prioridades">
          <Button variant="outline">← Volver a Matriz</Button>
        </Link>
      </div>

      {/* Grid de bloques */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Hora</th>
              {dayNames.map((day, idx) => (
                <th key={idx} className="border p-2">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <td className="border p-2 font-medium">{hour}:00</td>
                {dayNames.map((_, dayIdx) => {
                  const block = schedule[dayIdx]?.blocks?.find(b => b.hour === hour);
                  const occupied = block?.taskId;
                  const title = getTaskTitle(occupied);

                  return (
                    <td
                      key={`${dayIdx}-${hour}`}
                      className="border p-1"
                      onClick={() => {
                        if (occupied) {
                          handleRelease(dayIdx, hour);
                        }
                      }}
                    >
                      {occupied ? (
                        <div className="cursor-pointer rounded bg-blue-100 p-2 hover:bg-red-100">
                          <p className="truncate text-xs font-medium">{title}</p>
                        </div>
                      ) : (
                        <div className="h-12 bg-white hover:bg-gray-50" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded bg-blue-50 p-3 text-sm text-gray-700">
        <p>Haz clic en un bloque ocupado para liberarlo. Drag-drop está disponible en futuras versiones.</p>
      </div>
    </div>
  );
}
