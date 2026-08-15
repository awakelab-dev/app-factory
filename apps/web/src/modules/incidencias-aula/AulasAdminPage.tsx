import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@awk/ui';
import { ApiError, apiFetch } from '../../lib/api';
import { aulaSchema, aulasResponseSchema, type Aula } from './incidencias-aula.types';

const fieldClass =
  'w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; aulas: Aula[] };

/**
 * Pantalla mínima de gestión del catálogo de aulas — visible SOLO para
 * `admin` (gate funcional, decisión 4: AMPLIACIÓN de alcance sobre la spec
 * técnica original; ni coordinación ni dirección administran aulas). Alta +
 * renombrar/activar/desactivar; NUNCA borrado (hay incidencias que
 * referencian el aula). Pide `?todas=1` para ver también las inactivas — el
 * backend solo honra ese parámetro si quien pregunta es admin.
 */
export function AulasAdminPage() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function load() {
    apiFetch('/api/incidencias-aula/aulas?todas=1', aulasResponseSchema)
      .then((aulas) => setState({ status: 'ok', aulas }))
      .catch(() => setState({ status: 'error' }));
  }

  useEffect(load, []);

  async function onCreate() {
    if (!nuevoNombre.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await apiFetch('/api/incidencias-aula/aulas', aulaSchema, {
        method: 'POST',
        body: JSON.stringify({ nombre: nuevoNombre.trim() })
      });
      setNuevoNombre('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? `No se pudo crear (HTTP ${err.status}).` : 'No se pudo crear el aula.');
    } finally {
      setCreating(false);
    }
  }

  async function onToggleActiva(aula: Aula) {
    setError(null);
    try {
      await apiFetch(`/api/incidencias-aula/aulas/${aula.id}`, aulaSchema, {
        method: 'PATCH',
        body: JSON.stringify({ activa: !aula.activa })
      });
      load();
    } catch {
      setError('No se pudo actualizar el aula.');
    }
  }

  async function onRename(aula: Aula) {
    if (!editValue.trim()) return;
    setError(null);
    try {
      await apiFetch(`/api/incidencias-aula/aulas/${aula.id}`, aulaSchema, {
        method: 'PATCH',
        body: JSON.stringify({ nombre: editValue.trim() })
      });
      setEditingId(null);
      load();
    } catch (err) {
      setError(
        err instanceof ApiError ? `No se pudo renombrar (HTTP ${err.status}).` : 'No se pudo renombrar el aula.'
      );
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-white">
          Incidencias de Aula <span className="text-awk-cyan-400">·</span> aulas
        </h1>
        <p className="mt-2 text-sm text-awk-blue-300">
          Catálogo de aulas del centro. Desactivar un aula no la borra: sigue apareciendo en el histórico de
          Dirección, pero deja de estar disponible para nuevas incidencias.
        </p>
      </header>

      <section className="flex gap-2 rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-4">
        <input
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
          placeholder="Nombre del aula (p. ej. 1º DAM - A)"
          className={fieldClass}
          data-testid="nueva-aula-input"
        />
        <Button onClick={() => void onCreate()} disabled={creating} data-testid="crear-aula-button">
          {creating ? 'Creando…' : 'Crear'}
        </Button>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {state.status === 'loading' && <p className="text-awk-blue-300">Cargando…</p>}
      {state.status === 'error' && (
        <p className="text-red-400" data-testid="aulas-error">
          No se pudo cargar el catálogo de aulas.
        </p>
      )}
      {state.status === 'ok' && (
        <ul className="space-y-2" data-testid="aulas-list">
          {state.aulas.map((aula) => (
            <li
              key={aula.id}
              className="flex items-center justify-between rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-4"
            >
              {editingId === aula.id ? (
                <div className="flex flex-1 gap-2">
                  <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className={fieldClass} />
                  <Button size="sm" onClick={() => void onRename(aula)} data-testid="guardar-nombre-aula">
                    Guardar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-awk-blue-50">
                    {aula.nombre}{' '}
                    <span className={aula.activa ? 'text-awk-cyan-400' : 'text-awk-blue-500'}>
                      ({aula.activa ? 'activa' : 'inactiva'})
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(aula.id);
                        setEditValue(aula.nombre);
                      }}
                    >
                      <Pencil className="h-4 w-4" /> Renombrar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void onToggleActiva(aula)}
                      data-testid="toggle-activa-button"
                    >
                      {aula.activa ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
