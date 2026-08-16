import { useEffect, useState } from 'react';
import { Button } from '@awk/ui';
import { ApiError } from '../../lib/api';
import { createSala, fetchSalas, toggleActivaSala, updateSala } from './reserva-salas-api';
import type { Sala } from './reserva-salas.types';

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; salas: Sala[] };

const fieldClass =
  'w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none';

const emptyForm = { nombre: '', capacidad: '4', equipamiento: '' };

/**
 * Catálogo de salas — SOLO Recepción (spec-funcional.md, flujo Recepción
 * paso 4). Alta + edición inline + baja/reactivación lógica. `todas=true` en
 * `fetchSalas` para que Recepción también vea las de baja (spec-funcional.md
 * "Baja de sala": no aparecen en "Reservar" pero siguen en el catálogo para
 * poder reactivarlas). El backend revalida el rol en cada escritura —
 * `ReservaSalasPage` ya evita montar esta vista si el usuario no es
 * recepción, pero esto es defensa en profundidad, no el único control.
 */
export function CatalogoSalasView() {
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    setState({ status: 'loading' });
    fetchSalas(true)
      .then((salas) => setState({ status: 'ok', salas }))
      .catch(() => setState({ status: 'error' }));
  }

  useEffect(reload, []);

  async function onCreate() {
    setCreateError(null);
    const capacidad = Number(form.capacidad);
    if (!form.nombre.trim() || !Number.isInteger(capacidad) || capacidad < 1) {
      setCreateError('Indica un nombre y una capacidad válida (entero ≥ 1).');
      return;
    }
    setCreating(true);
    try {
      await createSala({ nombre: form.nombre.trim(), capacidad, equipamiento: form.equipamiento.trim() || undefined });
      setForm(emptyForm);
      reload();
    } catch (err) {
      setCreateError(
        err instanceof ApiError && err.status === 400 ? 'Ya existe una sala con ese nombre.' : 'No se pudo crear la sala.'
      );
    } finally {
      setCreating(false);
    }
  }

  async function onToggle(sala: Sala) {
    const accion = sala.activa ? 'dar de baja' : 'reactivar';
    if (!window.confirm(`¿Seguro que quieres ${accion} "${sala.nombre}"?`)) return;
    setBusyId(sala.id);
    try {
      await toggleActivaSala(sala.id);
      reload();
    } catch {
      setState({ status: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6">
        <h2 className="mb-3 text-sm font-medium text-awk-blue-100">Añadir sala</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-awk-blue-400">Nombre</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className={fieldClass}
              data-testid="nueva-sala-nombre"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-awk-blue-400">Capacidad</label>
            <input
              type="number"
              min={1}
              value={form.capacidad}
              onChange={(e) => setForm({ ...form, capacidad: e.target.value })}
              className={fieldClass}
              data-testid="nueva-sala-capacidad"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-awk-blue-400">Equipamiento</label>
            <input
              value={form.equipamiento}
              onChange={(e) => setForm({ ...form, equipamiento: e.target.value })}
              placeholder="Proyector, pizarra…"
              className={fieldClass}
            />
          </div>
        </div>
        {createError && <p className="mt-2 text-sm text-red-400">{createError}</p>}
        <div className="mt-3 flex justify-end">
          <Button onClick={() => void onCreate()} disabled={creating} data-testid="anadir-sala">
            {creating ? 'Añadiendo…' : 'Añadir sala'}
          </Button>
        </div>
      </section>

      {state.status === 'loading' && <p className="text-awk-blue-300">Cargando…</p>}
      {state.status === 'error' && <p className="text-red-400">No se pudo cargar el catálogo de salas.</p>}

      {state.status === 'ok' && (
        <div className="overflow-hidden rounded-xl border border-awk-blue-700">
          <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid="salas-table">
            <thead>
              <tr className="border-b border-awk-blue-700 text-xs uppercase tracking-wide text-awk-blue-400">
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Capacidad</th>
                <th className="px-4 py-2 font-medium">Equipamiento</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {state.salas.map((sala) =>
                editingId === sala.id ? (
                  <EditSalaRow
                    key={sala.id}
                    sala={sala}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      reload();
                    }}
                  />
                ) : (
                  <tr key={sala.id} className="border-b border-awk-blue-800 last:border-0" data-testid="sala-row">
                    <td className="px-4 py-2 text-awk-blue-50">{sala.nombre}</td>
                    <td className="px-4 py-2 text-awk-blue-300">{sala.capacidad}</td>
                    <td className="px-4 py-2 text-awk-blue-300">{sala.equipamiento ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          sala.activa ? 'border-awk-cyan-600 text-awk-cyan-300' : 'border-awk-blue-700 text-awk-blue-500'
                        }`}
                      >
                        {sala.activa ? 'Activa' : 'De baja'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(sala.id)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void onToggle(sala)}
                          disabled={busyId === sala.id}
                          data-testid="toggle-activa"
                        >
                          {sala.activa ? 'Dar de baja' : 'Reactivar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EditSalaRow({ sala, onCancel, onSaved }: { sala: Sala; onCancel: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(sala.nombre);
  const [capacidad, setCapacidad] = useState(String(sala.capacidad));
  const [equipamiento, setEquipamiento] = useState(sala.equipamiento ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    const capacidadNum = Number(capacidad);
    if (!Number.isInteger(capacidadNum) || capacidadNum < 1) {
      setError('Capacidad inválida.');
      return;
    }
    setSaving(true);
    try {
      await updateSala(sala.id, { nombre: nombre.trim(), capacidad: capacidadNum, equipamiento: equipamiento.trim() || null });
      onSaved();
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b border-awk-blue-800 bg-awk-navy-900/60 last:border-0" data-testid="sala-row-editing">
      <td className="px-4 py-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={fieldClass} />
      </td>
      <td className="px-4 py-2">
        <input type="number" min={1} value={capacidad} onChange={(e) => setCapacidad(e.target.value)} className={fieldClass} />
      </td>
      <td className="px-4 py-2">
        <input value={equipamiento} onChange={(e) => setEquipamiento(e.target.value)} className={fieldClass} />
      </td>
      <td className="px-4 py-2 text-xs text-awk-blue-500">{error}</td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => void onSave()} disabled={saving} data-testid="guardar-sala">
            Guardar
          </Button>
        </div>
      </td>
    </tr>
  );
}
