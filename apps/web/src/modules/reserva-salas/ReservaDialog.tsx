import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@awk/ui';
import { ApiError } from '../../lib/api';
import { createReserva } from './reserva-salas-api';
import type { Franja, Reserva, Sala } from './reserva-salas.types';

const fieldClass =
  'w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none disabled:cursor-not-allowed disabled:text-awk-blue-500';

/**
 * Diálogo de confirmación de reserva (spec-tecnica.md "Frontend"): sala,
 * día, hora, campo "A nombre de" y "Motivo" opcional. Empleado ve su propio
 * nombre PRE-RELLENADO y de solo lectura (spec-funcional.md, flujo Empleado
 * paso 4); Recepción lo ve vacío y editable, para reservar a nombre de un
 * tercero que puede no ser usuario de la plataforma (spec-tecnica.md
 * "Justificación de persona_nombre"). El backend es quien de verdad decide
 * a nombre de quién queda la reserva (ignora `personaNombre` si quien pide
 * no es Recepción) — este prefilling es solo UX.
 */
export function ReservaDialog({
  sala,
  fecha,
  hora,
  isRecepcion,
  currentUserName,
  onClose,
  onCreated
}: {
  sala: Sala;
  fecha: string;
  hora: Franja;
  isRecepcion: boolean;
  currentUserName: string;
  onClose: () => void;
  onCreated: (reserva: Reserva) => void;
}) {
  const [personaNombre, setPersonaNombre] = useState(isRecepcion ? '' : currentUserName);
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const reserva = await createReserva({
        salaId: sala.id,
        fecha,
        hora,
        motivo: motivo.trim() || undefined,
        personaNombre: isRecepcion ? personaNombre.trim() || undefined : undefined
      });
      onCreated(reserva);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Esa franja ya ha sido reservada por otra persona. Elige otro horario.');
      } else {
        setError('No se pudo crear la reserva.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      data-testid="reserva-dialog-backdrop"
    >
      <div
        className="w-full max-w-md rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="reserva-dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Confirmar reserva</h2>
          <button type="button" onClick={onClose} className="text-awk-blue-400 hover:text-awk-blue-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-awk-blue-300">
          {sala.nombre} · {fecha} · {hora}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-awk-blue-400">A nombre de</label>
            <input
              value={personaNombre}
              onChange={(e) => setPersonaNombre(e.target.value)}
              disabled={!isRecepcion}
              className={fieldClass}
              data-testid="persona-nombre-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-awk-blue-400">Motivo (opcional)</label>
            <textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className={fieldClass}
              data-testid="motivo-input"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-400" data-testid="reserva-dialog-error">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => void onConfirm()} disabled={submitting} data-testid="confirmar-reserva">
            {submitting ? 'Reservando…' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
