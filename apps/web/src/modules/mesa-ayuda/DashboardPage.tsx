import { useEffect, useState } from 'react';
import { getDashboard, listTickets } from './mesa-ayuda-api';
import type { Dashboard, Ticket } from './mesa-ayuda.types';

/**
 * Panel de soporte para agentes: métricas rápidas y acceso a tickets.
 */
export function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dashboardData, ticketsData] = await Promise.all([
          getDashboard(),
          listTickets({ assignedToMe: true })
        ]);
        setDashboard(dashboardData);
        setRecentTickets(ticketsData.slice(0, 5));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err) {
        setError('Error al cargar datos del dashboard');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Panel de Soporte</h1>
        <p className="text-gray-600">Resumen de actividad y tickets pendientes</p>
      </div>

      {/* Métricas */}
      {dashboard && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-medium text-gray-600">Tickets Abiertos</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{dashboard.openTickets}</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-medium text-gray-600">Asignados a Ti</h3>
            <p className="mt-2 text-3xl font-bold text-blue-600">{dashboard.myAssignedTickets}</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-medium text-gray-600">SLA Vencidos</h3>
            <p className="mt-2 text-3xl font-bold text-red-600">{dashboard.overdueSLAs}</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-medium text-gray-600">Total de Tickets</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{dashboard.allTickets}</p>
          </div>
        </div>
      )}

      {/* Tickets recientes */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Mis Tickets Recientes</h2>

        {recentTickets.length === 0 ? (
          <p className="text-gray-600">No tienes tickets asignados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">#</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Asunto</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Prioridad</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Solicitante</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">#{ticket.ticket_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.subject}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                          ticket.priority === 'urgente'
                            ? 'bg-red-100 text-red-800'
                            : ticket.priority === 'alta'
                              ? 'bg-orange-100 text-orange-800'
                              : ticket.priority === 'media'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                          ticket.status === 'resuelto' || ticket.status === 'cerrado'
                            ? 'bg-green-100 text-green-800'
                            : ticket.status === 'en_proceso'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ticket.requestorName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
