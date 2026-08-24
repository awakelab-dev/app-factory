import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listTickets } from './mesa-ayuda-api';
import type { Ticket } from './mesa-ayuda.types';

/**
 * Página de listado de tickets para agentes: filtrable por estado, prioridad, etc.
 */
export function TicketListPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assignedToMe: false
  });

  useEffect(() => {
    const loadTickets = async () => {
      try {
        const data = await listTickets(filters);
        setTickets(data);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err) {
        setError('Error al cargar tickets');
      } finally {
        setLoading(false);
      }
    };
    loadTickets();
  }, [filters]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tickets de Soporte</h1>
        <p className="text-gray-600">Gestión de tickets y seguimiento</p>
      </div>

      {/* Filtros */}
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="abierto">Abierto</option>
              <option value="en_proceso">En Proceso</option>
              <option value="resuelto">Resuelto</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Prioridad</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">Todas</option>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Asignación</label>
            <select
              value={filters.assignedToMe ? 'me' : 'all'}
              onChange={(e) => setFilters({ ...filters, assignedToMe: e.target.value === 'me' })}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="all">Todos</option>
              <option value="me">Asignados a mí</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', priority: '', assignedToMe: false })}
              className="w-full rounded bg-gray-200 py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de tickets */}
      {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">#</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Asunto</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Solicitante</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Prioridad</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Estado</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Creado</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-600">
                  No hay tickets con estos filtros
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => navigate(`/mesa-ayuda/tickets/${ticket.id}`)}
                  className="border-b border-gray-200 hover:cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">#{ticket.ticket_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ticket.subject}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{ticket.requestorName}</td>
                  <td className="px-6 py-4 text-sm">
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
                  <td className="px-6 py-4 text-sm">
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
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
