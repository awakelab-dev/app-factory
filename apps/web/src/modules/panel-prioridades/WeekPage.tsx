import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { scheduleWeekSchema } from './panel-prioridades.types';

export function WeekPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    try {
      setLoading(true);
      const response = await apiFetch('/api/panel-prioridades/schedule', scheduleWeekSchema);
      void response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar agenda');
    } finally {
      setLoading(false);
    }
  }

  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white">
          Panel de Prioridades <span className="text-awk-cyan-400">·</span> semana
        </h1>
        <p className="mt-2 text-sm text-awk-blue-300">
          Time-blocking: reserva bloques de tiempo para tareas importantes
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-800 bg-red-900/20 p-4">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-awk-blue-300">Cargando agenda…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-awk-navy-800 text-left text-sm border border-awk-blue-700 rounded-lg">
            <thead>
              <tr className="border-b border-awk-blue-700 bg-awk-navy-800">
                <th className="px-4 py-2 font-medium text-awk-blue-100">Hora</th>
                {days.map(day => (
                  <th key={day} className="px-4 py-2 font-medium text-awk-blue-100">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => {
                const hour = 8 + i;
                return (
                  <tr key={hour} className="border-b border-awk-blue-700 hover:bg-awk-blue-800/20">
                    <td className="px-4 py-2 font-medium text-awk-blue-200">{hour}:00</td>
                    {days.map((_, dayIdx) => (
                      <td
                        key={dayIdx}
                        className="px-4 py-2 border-l border-awk-blue-700 bg-awk-blue-800/20 cursor-pointer hover:bg-awk-blue-800/40"
                      >
                        <div className="h-10 rounded bg-awk-cyan-400/20 border border-awk-cyan-400/40" />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
