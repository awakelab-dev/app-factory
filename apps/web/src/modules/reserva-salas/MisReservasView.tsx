import { useEffect, useState } from 'react';
import { Button } from '@awk/ui';
import { cancelReserva, fetchReservas } from './reserva-salas-api';
import type { Reserva } from './reserva-salas.types';

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; rows: Reserva[] };

/**
 * "Mis reservas" (empleado) / "Todas las reservas" (recepción) —
 * spec-funcional.md, flujos Empleado paso 6 y Recepción paso 3. El backend
 * ya filtra por `userId` para empleado (`GET /reservas`); esta vista solo
 * pinta lo que reciba, sin re-filtrar en el cliente. Cancelar pide
 * confirmación explícita (gate técnico, nota pendiente 4) con
 * `window.confirm` — mismo patrón que `TaskModal.tsx#onDelete` de
 * `gestor-proyectos`, el único precedente de cancelación destructiva en el
 * repo.
 */
export function MisReservasView({ isRecepcion }: { isRecepcion: boolean }) {
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function reload() {
    setState({ status: 'loading' });
    fetchReservas()
      .then((rows) => setState({ status: 'ok', rows: rows.filter((r) => !r.canceladaAt) }))
      .catch(() => setState({ status: 'error' }));
  }

  useEffect(reload, []);

  async function onCancel(reserva: Reserva) {
    if (!window.confirm(`¿Cancelar la reserva de "${reserva.salaNombre}" el ${reserva.fecha} a las ${reserva.hora}?`)) {
      return;
    }
    setCancellingId(reserva.id);
    try {
      await cancelReserva(reserva.id);
      reload();
    } catch {
      setState({ status: 'error' });
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-awk-blue-100">{isRecepcion ? 'Todas las reservas' : 'Mis reservas'}</h2>

      {state.status === 'loading' && <p className="text-awk-blue-300">Cargando…</p>}
      {state.status === 'error' && (
        <p className="text-red-400" data-testid="reservas-error">
          No se pudo cargar la lista de reservas.
        </p>
      )}

      {state.status === 'ok' && state.rows.length === 0 && (
        <p className="rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6 text-sm text-awk-blue-400">
          {isRecepcion ? 'No hay reservas activas.' : 'Todavía no tienes reservas.'}
        </p>
      )}

      {state.status === 'ok' && state.rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-awk-blue-700">
          <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid="reservas-table">
            <thead>
              <tr className="border-b border-awk-blue-700 text-xs uppercase tracking-wide text-awk-blue-400">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Hora</th>
                <th className="px-4 py-2 font-medium">Sala</th>
                {isRecepcion && <th className="px-4 py-2 font-medium">A nombre de</th>}
                <th className="px-4 py-2 font-medium">Motivo</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {state.rows.map((reserva) => (
                <tr key={reserva.id} className="border-b border-awk-blue-800 last:border-0" data-testid="reserva-row">
                  <td className="px-4 py-2 text-awk-blue-50">{reserva.fecha}</td>
                  <td className="px-4 py-2 text-awk-blue-300">{reserva.hora}</td>
                  <td className="px-4 py-2 text-awk-blue-300">{reserva.salaNombre}</td>
                  {isRecepcion && <td className="px-4 py-2 text-awk-blue-300">{reserva.personaNombre}</td>}
                  <td className="px-4 py-2 text-awk-blue-400">{reserva.motivo ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void onCancel(reserva)}
                      disabled={cancellingId === reserva.id}
                      data-testid="cancelar-reserva"
                    >
                      Cancelar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
