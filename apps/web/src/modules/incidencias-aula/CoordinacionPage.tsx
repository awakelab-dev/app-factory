import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@awk/ui';
import { ApiError, apiFetch } from '../../lib/api';
import { DetailModal } from './DocentePage';
import {
  aulasResponseSchema,
  incidenciaDetailSchema,
  incidenciasResponseSchema,
  type Aula,
  type EstadoIncidencia,
  type IncidenciaDetail,
  type IncidenciaRow
} from './incidencias-aula.types';
import { ESTADO_ACCENT, ESTADO_LABEL, GRAVEDAD_LABEL, TIPO_LABEL } from './incidencias-labels';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; rows: IncidenciaRow[] };

const fieldClass =
  'rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none';

function buildQuery(filters: { estado?: EstadoIncidencia; aulaId?: string }): string {
  const params = new URLSearchParams();
  if (filters.estado) params.set('estado', filters.estado);
  if (filters.aulaId) params.set('aulaId', filters.aulaId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Bandeja de coordinación (spec-tecnica.md `incidencias-aula`, rol
 * `incidencias_coordinacion`): KPIs + filtros + tabla completa + detalle con
 * las tres acciones (tomar, seguimiento, cerrar). Gate funcional decisión 5:
 * SIN partición — cualquier persona de coordinación ve/gestiona toda la
 * bandeja, sin campo de "mis casos".
 */
export function CoordinacionPage() {
  const [allRows, setAllRows] = useState<IncidenciaRow[] | null>(null);
  const [listState, setListState] = useState<ListState>({ status: 'loading' });
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [filters, setFilters] = useState<{ estado?: EstadoIncidencia; aulaId?: string }>({});
  const [openId, setOpenId] = useState<string | null>(null);

  // KPIs: siempre sobre la bandeja COMPLETA, independientes del filtro que
  // se esté aplicando a la tabla (cargados una sola vez).
  useEffect(() => {
    apiFetch('/api/incidencias-aula/incidencias', incidenciasResponseSchema)
      .then(setAllRows)
      .catch(() => setAllRows([]));
    apiFetch('/api/incidencias-aula/aulas', aulasResponseSchema)
      .then(setAulas)
      .catch(() => setAulas([]));
  }, []);

  const loadFiltered = useCallback((f: { estado?: EstadoIncidencia; aulaId?: string }) => {
    setListState({ status: 'loading' });
    apiFetch(`/api/incidencias-aula/incidencias${buildQuery(f)}`, incidenciasResponseSchema)
      .then((rows) => setListState({ status: 'ok', rows }))
      .catch((err: unknown) =>
        setListState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, []);

  useEffect(() => {
    loadFiltered(filters);
  }, [filters, loadFiltered]);

  function onIncidenciaChanged() {
    // Una acción (tomar/seguimiento/cerrar) puede cambiar el estado — se
    // refresca tanto la tabla filtrada como los KPIs.
    loadFiltered(filters);
    apiFetch('/api/incidencias-aula/incidencias', incidenciasResponseSchema)
      .then(setAllRows)
      .catch(() => undefined);
  }

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold text-white">
          Incidencias de Aula <span className="text-awk-cyan-400">·</span> bandeja
        </h1>
        <p className="mt-2 text-sm text-awk-blue-300">Bandeja completa del centro — sin partición por persona.</p>
      </header>

      {allRows && (
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard icon={Inbox} label="Sin tomar" value={allRows.filter((r) => r.estado === 'abierta').length} />
          <KpiCard icon={Clock} label="En curso" value={allRows.filter((r) => r.estado === 'en_curso').length} />
          <KpiCard
            icon={AlertTriangle}
            label="Gravedad alta"
            value={allRows.filter((r) => r.gravedad === 'alta').length}
            accent="text-red-400"
          />
          <KpiCard icon={CheckCircle2} label="Cerradas" value={allRows.filter((r) => r.estado === 'cerrada').length} />
        </section>
      )}

      <section className="flex flex-wrap gap-3">
        <select
          value={filters.estado ?? ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, estado: (e.target.value || undefined) as EstadoIncidencia | undefined }))
          }
          className={fieldClass}
          data-testid="filtro-estado"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={filters.aulaId ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, aulaId: e.target.value || undefined }))}
          className={fieldClass}
          data-testid="filtro-aula"
        >
          <option value="">Todas las aulas</option>
          {aulas.map((aula) => (
            <option key={aula.id} value={aula.id}>
              {aula.nombre}
            </option>
          ))}
        </select>
      </section>

      {listState.status === 'loading' && <p className="text-awk-blue-300">Cargando…</p>}
      {listState.status === 'error' && (
        <p className="text-red-400" data-testid="bandeja-error">
          No se pudo cargar la bandeja ({listState.detail}).
        </p>
      )}
      {listState.status === 'ok' && (
        <div className="overflow-hidden rounded-xl border border-awk-blue-700">
          {listState.rows.length === 0 ? (
            <p className="bg-awk-navy-800 p-6 text-sm text-awk-blue-400" data-testid="bandeja-empty">
              No hay incidencias con estos filtros.
            </p>
          ) : (
            <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid="bandeja-table">
              <thead>
                <tr className="border-b border-awk-blue-700 text-xs uppercase tracking-wide text-awk-blue-400">
                  <th className="px-4 py-2 font-medium">Alumno</th>
                  <th className="px-4 py-2 font-medium">Aula</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Gravedad</th>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {listState.rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setOpenId(row.id)}
                    className="cursor-pointer border-b border-awk-blue-800 last:border-0 hover:bg-awk-blue-900/40"
                    data-testid="bandeja-row"
                  >
                    <td className="px-4 py-2 text-awk-blue-50">{row.alumnoNombre}</td>
                    <td className="px-4 py-2 text-awk-blue-300">{row.aulaNombre}</td>
                    <td className="px-4 py-2 text-awk-blue-300">{TIPO_LABEL[row.tipo]}</td>
                    <td className="px-4 py-2 text-awk-blue-300">{GRAVEDAD_LABEL[row.gravedad]}</td>
                    <td className="px-4 py-2 text-awk-blue-300">{row.fechaHecho}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${ESTADO_ACCENT[row.estado]}`}>
                        {ESTADO_LABEL[row.estado]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {openId && (
        <DetailModal
          incidenciaId={openId}
          onClose={() => {
            setOpenId(null);
            onIncidenciaChanged();
          }}
          actions={(incidencia, onChanged) => <CoordinacionActions incidencia={incidencia} onChanged={onChanged} />}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-awk-blue-800 bg-awk-navy-800 p-4">
      <div className="flex items-center gap-2 text-awk-blue-300">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${accent ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

function CoordinacionActions({
  incidencia,
  onChanged
}: {
  incidencia: IncidenciaDetail;
  onChanged: (updated: IncidenciaDetail) => void;
}) {
  const [seguimientoTexto, setSeguimientoTexto] = useState('');
  const [resolucion, setResolucion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCerrar, setShowCerrar] = useState(false);

  async function onTomar() {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch(
        `/api/incidencias-aula/incidencias/${incidencia.id}/tomar`,
        incidenciaDetailSchema,
        { method: 'POST' }
      );
      onChanged(updated);
    } catch {
      setError('No se pudo tomar el caso.');
    } finally {
      setBusy(false);
    }
  }

  async function onAddSeguimiento() {
    if (!seguimientoTexto.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch(
        `/api/incidencias-aula/incidencias/${incidencia.id}/seguimiento`,
        incidenciaDetailSchema,
        { method: 'POST', body: JSON.stringify({ texto: seguimientoTexto.trim() }) }
      );
      onChanged(updated);
      setSeguimientoTexto('');
    } catch {
      setError('No se pudo guardar el seguimiento.');
    } finally {
      setBusy(false);
    }
  }

  async function onCerrar() {
    if (!resolucion.trim()) {
      setError('La resolución es obligatoria para cerrar la incidencia.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch(
        `/api/incidencias-aula/incidencias/${incidencia.id}/cerrar`,
        incidenciaDetailSchema,
        { method: 'POST', body: JSON.stringify({ resolucion: resolucion.trim() }) }
      );
      onChanged(updated);
      setShowCerrar(false);
    } catch (err) {
      setError(
        err instanceof ApiError ? `No se pudo cerrar (HTTP ${err.status}).` : 'No se pudo cerrar la incidencia.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (!incidencia.canAct && !incidencia.canTomar) return null;

  return (
    <div className="space-y-3 border-t border-awk-blue-700 pt-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {incidencia.canTomar && (
          <Button size="sm" onClick={() => void onTomar()} disabled={busy} data-testid="tomar-button">
            Tomar el caso
          </Button>
        )}
        {incidencia.canAct && !showCerrar && (
          <Button variant="ghost" size="sm" onClick={() => setShowCerrar(true)} disabled={busy} data-testid="mostrar-cerrar">
            Cerrar incidencia
          </Button>
        )}
      </div>

      {incidencia.canAct && (
        <div className="flex gap-2">
          <textarea
            rows={2}
            value={seguimientoTexto}
            onChange={(e) => setSeguimientoTexto(e.target.value)}
            placeholder="Añadir entrada de seguimiento…"
            className="w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none"
            data-testid="seguimiento-input"
          />
          <Button size="sm" onClick={() => void onAddSeguimiento()} disabled={busy} data-testid="guardar-seguimiento">
            Guardar
          </Button>
        </div>
      )}

      {incidencia.canAct && showCerrar && (
        <div className="rounded-lg border border-red-700 bg-red-950/30 p-3" data-testid="cerrar-form">
          <label className="mb-1 block text-xs text-red-300">Resolución adoptada (obligatoria)</label>
          <textarea
            rows={3}
            value={resolucion}
            onChange={(e) => setResolucion(e.target.value)}
            className="w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none"
            data-testid="resolucion-input"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowCerrar(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => void onCerrar()} disabled={busy} data-testid="confirmar-cerrar">
              Confirmar cierre
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
