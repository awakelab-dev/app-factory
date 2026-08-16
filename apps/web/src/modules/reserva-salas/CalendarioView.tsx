import { useEffect, useState } from 'react';
import { fetchSalaDetail, fetchSalas } from './reserva-salas-api';
import { CAPACIDAD_FILTROS, FRANJA_ESTADO_ACCENT } from './reserva-salas-labels';
import { FRANJAS, todayDateOnly } from './reserva-salas-franjas';
import { ReservaDialog } from './ReservaDialog';
import type { Franja, Sala, SalaDetail } from './reserva-salas.types';

type GridState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; filas: SalaDetail[] };

/**
 * Vista "Reservar" (spec-tecnica.md "Frontend" / spec-funcional.md, flujo
 * Empleado pasos 2-5): selector de día + filtro de capacidad mínima, rejilla
 * salas × franjas horarias. Cada fila es el detalle de UNA sala para el día
 * elegido (`GET /salas/:id?fecha=`), pedido en paralelo por sala — el
 * catálogo (`GET /salas`, solo activas) ya viene filtrado del backend, así
 * que las salas de baja nunca llegan a pintarse aquí (spec-funcional.md
 * "Baja de sala").
 */
export function CalendarioView({
  isRecepcion,
  currentUserName
}: {
  isRecepcion: boolean;
  currentUserName: string;
}) {
  const [fecha, setFecha] = useState(todayDateOnly());
  const [minCapacidad, setMinCapacidad] = useState(0);
  const [state, setState] = useState<GridState>({ status: 'loading' });
  const [dialogTarget, setDialogTarget] = useState<{ sala: Sala; hora: Franja } | null>(null);

  function reload() {
    setState({ status: 'loading' });
    fetchSalas(false)
      .then((salas) => Promise.all(salas.map((sala) => fetchSalaDetail(sala.id, fecha))))
      .then((filas) => setState({ status: 'ok', filas }))
      .catch(() => setState({ status: 'error' }));
  }

  useEffect(reload, [fecha]);

  const filas = state.status === 'ok' ? state.filas.filter((f) => f.capacidad >= minCapacidad) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs text-awk-blue-400">Día</label>
          <input
            type="date"
            value={fecha}
            min={todayDateOnly()}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none"
            data-testid="fecha-input"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-awk-blue-400">Capacidad mínima</label>
          <select
            value={minCapacidad}
            onChange={(e) => setMinCapacidad(Number(e.target.value))}
            className="rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none"
            data-testid="capacidad-select"
          >
            {CAPACIDAD_FILTROS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.status === 'loading' && <p className="text-awk-blue-300">Cargando salas…</p>}
      {state.status === 'error' && (
        <p className="text-red-400" data-testid="grid-error">
          No se pudo cargar la rejilla de salas.
        </p>
      )}

      {state.status === 'ok' && filas.length === 0 && (
        <p className="rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6 text-sm text-awk-blue-400">
          Ninguna sala activa cumple ese filtro de capacidad.
        </p>
      )}

      {state.status === 'ok' && filas.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-awk-blue-700">
          <table className="w-full min-w-[640px] bg-awk-navy-800 text-left text-sm" data-testid="calendario-grid">
            <thead>
              <tr className="border-b border-awk-blue-700 text-xs uppercase tracking-wide text-awk-blue-400">
                <th className="px-4 py-2 font-medium">Sala</th>
                {FRANJAS.map((hora) => (
                  <th key={hora} className="px-2 py-2 text-center font-medium">
                    {hora}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.id} className="border-b border-awk-blue-800 last:border-0">
                  <td className="px-4 py-2 align-top">
                    <p className="font-medium text-awk-blue-50">{fila.nombre}</p>
                    <p className="text-xs text-awk-blue-400">
                      {fila.capacidad} pers. {fila.equipamiento ? `· ${fila.equipamiento}` : ''}
                    </p>
                  </td>
                  {fila.franjas.map((slot) => (
                    <td key={slot.hora} className="px-1 py-2 text-center">
                      <button
                        type="button"
                        disabled={slot.estado !== 'libre'}
                        onClick={() => setDialogTarget({ sala: fila, hora: slot.hora })}
                        data-testid={`slot-${fila.id}-${slot.hora}`}
                        className={`w-full rounded-lg border px-2 py-1.5 text-xs transition-colors disabled:cursor-not-allowed ${FRANJA_ESTADO_ACCENT[slot.estado]}`}
                      >
                        {slot.estado === 'libre' && 'Libre'}
                        {slot.estado === 'tuya' && 'Tuya'}
                        {slot.estado === 'ocupada' && (slot.ocupantePorLabel ?? 'Ocupada')}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogTarget && (
        <ReservaDialog
          sala={dialogTarget.sala}
          fecha={fecha}
          hora={dialogTarget.hora}
          isRecepcion={isRecepcion}
          currentUserName={currentUserName}
          onClose={() => setDialogTarget(null)}
          onCreated={() => {
            setDialogTarget(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
