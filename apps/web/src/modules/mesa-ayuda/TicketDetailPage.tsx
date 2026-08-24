import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getTicketPublic, addTicketMessage, updateTicket } from './mesa-ayuda-api';
import type { TicketDetail } from './mesa-ayuda.types';
import { useAuth } from '../../auth/auth-context';

/**
 * Página de detalle de ticket: accesible públicamente (con sessionToken)
 * o por agentes/admin autenticados.
 */
export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get('sessionToken');
  const { user } = useAuth();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');

  useEffect(() => {
    const loadTicket = async () => {
      if (!id) return;
      try {
        // Si tenemos sessionToken, cargar como público
        if (sessionToken) {
          const data = await getTicketPublic(id, sessionToken);
          setTicket(data);
          setNewStatus(data.status);
        } else if (user) {
          // Usar método autenticado (requiere que exista en API)
          // Por ahora, asumimos que getTicketPublic funciona para ambos casos
          const data = await getTicketPublic(id, sessionToken || '');
          setTicket(data);
          setNewStatus(data.status);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message || 'Error al cargar el ticket');
      } finally {
        setLoading(false);
      }
    };
    loadTicket();
  }, [id, sessionToken, user]);

  const handleAddMessage = async () => {
    if (!id || !messageText.trim()) return;
    try {
      await addTicketMessage(id, {
        content: messageText,
        isPublic: true
      });
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                {
                  id: crypto.randomUUID(),
                  senderEmail: user?.email || 'Anónimo',
                  senderName: user?.displayName || 'Solicitante',
                  content: messageText,
                  isPublic: true,
                  createdAt: new Date()
                }
              ],
              updatedAt: new Date()
            }
          : null
      );
      setMessageText('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    } catch (_err: any) {
      setError('Error al enviar mensaje');
    }
  };

  const handleStatusChange = async () => {
    if (!id || newStatus === ticket?.status) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatedTicket = await updateTicket(id, { status: newStatus as any });
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              status: updatedTicket.status,
              updatedAt: new Date()
            }
          : null
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    } catch (_err: any) {
      setError('Error al actualizar estado');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen text-red-600">{error}</div>;
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Ticket no encontrado
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Cabecera */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">#{ticket.ticket_number}</h1>
            <p className="text-gray-600">{ticket.subject}</p>
          </div>
          <div className="text-right">
            <span
              className={`inline-block rounded px-3 py-1 text-sm font-semibold ${
                ticket.status === 'resuelto' || ticket.status === 'cerrado'
                  ? 'bg-green-100 text-green-800'
                  : ticket.status === 'en_proceso'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
              }`}
            >
              {ticket.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
          <div>
            <p className="text-sm font-medium text-gray-600">Departamento</p>
            <p className="text-gray-900">{ticket.departmentName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Tema</p>
            <p className="text-gray-900">{ticket.topicName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Prioridad</p>
            <p className="text-gray-900">{ticket.priority}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Solicitante</p>
            <p className="text-gray-900">{ticket.requestorName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Email</p>
            <p className="text-gray-900">{ticket.requestorEmail}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Creado</p>
            <p className="text-gray-900">{new Date(ticket.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Descripción */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Descripción</h2>
        <p className="whitespace-pre-wrap text-gray-700">{ticket.description}</p>
      </div>

      {/* Mensajes */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Conversación</h2>

        <div className="space-y-4">
          {ticket.messages.map((msg) => (
            <div key={msg.id} className="border-l-4 border-gray-300 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">{msg.senderName}</p>
              <p className="text-xs text-gray-500">{new Date(msg.createdAt).toLocaleString()}</p>
              <p className="mt-2 text-gray-700">{msg.content}</p>
            </div>
          ))}
        </div>

        {/* Nuevo mensaje */}
        {(!sessionToken || user) && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700">Agregar comentario</label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="mt-2 block w-full rounded border border-gray-300 px-3 py-2"
              rows={4}
              placeholder="Escribe tu mensaje aquí..."
            />
            <button
              onClick={handleAddMessage}
              disabled={!messageText.trim()}
              className="mt-3 rounded bg-blue-600 py-2 px-4 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Enviar Comentario
            </button>
          </div>
        )}
      </div>

      {/* Actualizar estado (solo agentes) */}
      {user && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold text-gray-900">Gestión del Ticket</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Cambiar estado</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              >
                <option value="abierto">Abierto</option>
                <option value="en_proceso">En Proceso</option>
                <option value="resuelto">Resuelto</option>
                <option value="cerrado">Cerrado</option>
                <option value="reabierto">Reabierto</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleStatusChange}
                disabled={newStatus === ticket.status}
                className="w-full rounded bg-green-600 py-2 px-4 font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
