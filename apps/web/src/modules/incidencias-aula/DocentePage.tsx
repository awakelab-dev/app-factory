import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@awk/ui';
import { ApiError, apiFetch } from '../../lib/api';
import {
  aulasResponseSchema,
  incidenciaDetailSchema,
  incidenciasResponseSchema,
  incidenciaRowSchema,
  type Aula,
  type IncidenciaDetail,
  type IncidenciaRow,
  type IncidenciaGravedad,
  type IncidenciaTipo
} from './incidencias-aula.types';
import { ESTADO_ACCENT, ESTADO_LABEL, GRAVEDAD_LABEL, TIPO_LABEL } from './incidencias-labels';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; rows: IncidenciaRow[] };

type AulasState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; aulas: Aula[] };

const fieldClass =
  'w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none';

const emptyForm = {
  alumnoNombre: '',
  aulaId: '',
  tipo: 'convivencia' as IncidenciaTipo,
  gravedad: 'media' as IncidenciaGravedad,
  fechaHecho: new Date().toISOString().slice(0, 10),
  relato: ''
};

/**
 * Vista del docente (spec-tecnica.md `incidencias-aula`, rol
 * `incidencias_docente`): formulario de alta + "mis incidencias" + detalle de
 * SOLO LECTURA (sin acciones — tomar/seguimiento/cerrar son de coordinación).
 * El backend ya impide que el docente vea partes de otros docentes
 * (`IncidenciasPermissionsService.canViewDetail`, 403 si no es la suya); esta
 * página además solo pinta los suyos (`GET .../incidencias/mias`).
 */
export function DocentePage() {
  const [aulasState, setAulasState] = useState<AulasState>({ status: 'loading' });
  const [listState, setListState] = useState<ListState>({ status: 'loading' });
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  function loadMias() {
    apiFetch('/api/incidencias-aula/incidencias/mias', incidenciasResponseSchema)
      .then((rows) => setListState({ status: 'ok', rows }))
      .catch((err: unknown) =>
        setListState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }

  useEffect(() => {
    apiFetch('/api/incidencias-aula/aulas', aulasResponseSchema)
      .then((aulas) => {
        setAulasState({ status: 'ok', aulas });
        setForm((f) => (f.aulaId ? f : { ...f, aulaId: aulas[0]?.id ?? '' }));
      })
      .catch(() => setAulasState({ status: 'error' }));
    loadMias();
  }, []);

  async function onSubmit() {
    setSubmitError(null);
    if (!form.aulaId) {
      setSubmitError('Selecciona un aula.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/incidencias-aula/incidencias', incidenciaRowSchema, {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setForm((f) => ({ ...emptyForm, aulaId: f.aulaId }));
      loadMias();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? `No se pudo registrar (HTTP ${err.status}).` : 'No se pudo registrar la incidencia.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white">
          Incidencias de Aula <span className="text-awk-cyan-400">·</span> registrar
        </h1>
        <p className="mt-2 text-sm text-awk-blue-300">
          Registra un parte y consulta el estado de tus propias incidencias — no ves las de otros docentes.
        </p>
      </header>

      <section className="rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6">
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Este formulario registra datos personales del alumnado (nombre y relato de la conducta) con acceso
            restringido a coordinación y dirección del centro.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-awk-blue-400">Alumno/a</label>
            <input
              value={form.alumnoNombre}
              onChange={(e) => setForm({ ...form, alumnoNombre: e.target.value })}
              className={fieldClass}
              data-testid="alumno-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-awk-blue-400">Aula</label>
            <select
              value={form.aulaId}
              onChange={(e) => setForm({ ...form, aulaId: e.target.value })}
              className={fieldClass}
              data-testid="aula-select"
            >
              {aulasState.status === 'ok' &&
                aulasState.aulas.map((aula) => (
                  <option key={aula.id} value={aula.id}>
                    {aula.nombre}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-awk-blue-400">Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as IncidenciaTipo })}
              className={fieldClass}
              data-testid="tipo-select"
            >
              {Object.entries(TIPO_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-awk-blue-400">Gravedad</label>
            <select
              value={form.gravedad}
              onChange={(e) => setForm({ ...form, gravedad: e.target.value as IncidenciaGravedad })}
              className={fieldClass}
              data-testid="gravedad-select"
            >
              {Object.entries(GRAVEDAD_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-awk-blue-400">Fecha del hecho</label>
            <input
              type="date"
              value={form.fechaHecho}
              onChange={(e) => setForm({ ...form, fechaHecho: e.target.value })}
              className={fieldClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-awk-blue-400">Relato objetivo de lo ocurrido</label>
            <textarea
              rows={4}
              value={form.relato}
              onChange={(e) => setForm({ ...form, relato: e.target.value })}
              className={fieldClass}
              data-testid="relato-input"
            />
          </div>
        </div>

        {submitError && <p className="mt-3 text-sm text-red-400">{submitError}</p>}

        <div className="mt-4 flex justify-end">
          <Button onClick={() => void onSubmit()} disabled={submitting} data-testid="submit-incidencia">
            {submitting ? 'Registrando…' : 'Registrar incidencia'}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-awk-blue-100">Mis incidencias</h2>
        {listState.status === 'loading' && <p className="text-awk-blue-300">Cargando…</p>}
        {listState.status === 'error' && (
          <p className="text-red-400" data-testid="mias-error">
            No se pudo cargar la lista ({listState.detail}).
          </p>
        )}
        {listState.status === 'ok' && (
          <IncidenciasTable rows={listState.rows} onOpen={setOpenId} emptyHint="Todavía no has registrado ninguna." />
        )}
      </section>

      {openId && <DetailModal incidenciaId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function IncidenciasTable({
  rows,
  onOpen,
  emptyHint
}: {
  rows: IncidenciaRow[];
  onOpen: (id: string) => void;
  emptyHint: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6 text-sm text-awk-blue-400">
        {emptyHint}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-awk-blue-700">
      <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid="mias-table">
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
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onOpen(row.id)}
              className="cursor-pointer border-b border-awk-blue-800 last:border-0 hover:bg-awk-blue-900/40"
              data-testid="incidencia-row"
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
    </div>
  );
}

type DetailState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; incidencia: IncidenciaDetail };

/** Modal de detalle de SOLO LECTURA — reutilizado por Docente (sin acciones)
 * y por Coordinación (con acciones, ver `CoordinacionPage.tsx`), cada uno
 * pasa sus propias acciones opcionales. */
export function DetailModal({
  incidenciaId,
  onClose,
  actions
}: {
  incidenciaId: string;
  onClose: () => void;
  actions?: (incidencia: IncidenciaDetail, onChanged: (updated: IncidenciaDetail) => void) => ReactNode;
}) {
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    apiFetch(`/api/incidencias-aula/incidencias/${incidenciaId}`, incidenciaDetailSchema)
      .then((incidencia) => setState({ status: 'ok', incidencia }))
      .catch(() => setState({ status: 'error' }));
  }, [incidenciaId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      data-testid="detail-modal-backdrop"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="detail-modal"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Detalle de la incidencia</h2>
          <button type="button" onClick={onClose} className="text-awk-blue-400 hover:text-awk-blue-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {state.status === 'loading' && <p className="mt-4 text-awk-blue-300">Cargando…</p>}
        {state.status === 'error' && (
          <p className="mt-4 text-red-400" data-testid="detail-error">
            No se pudo cargar el detalle.
          </p>
        )}
        {state.status === 'ok' && (
          <DetailBody
            incidencia={state.incidencia}
            onChanged={(updated) => setState({ status: 'ok', incidencia: updated })}
            actions={actions}
          />
        )}
      </div>
    </div>
  );
}

function DetailBody({
  incidencia,
  onChanged,
  actions
}: {
  incidencia: IncidenciaDetail;
  onChanged: (updated: IncidenciaDetail) => void;
  actions?: (incidencia: IncidenciaDetail, onChanged: (updated: IncidenciaDetail) => void) => ReactNode;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Alumno/a" value={incidencia.alumnoNombre} />
        <Field label="Aula" value={incidencia.aulaNombre} />
        <Field label="Tipo" value={TIPO_LABEL[incidencia.tipo]} />
        <Field label="Gravedad" value={GRAVEDAD_LABEL[incidencia.gravedad]} />
        <Field label="Fecha del hecho" value={incidencia.fechaHecho} />
        <div>
          <p className="text-xs text-awk-blue-400">Estado</p>
          <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs ${ESTADO_ACCENT[incidencia.estado]}`}>
            {ESTADO_LABEL[incidencia.estado]}
          </span>
        </div>
      </div>

      <div>
        <p className="text-xs text-awk-blue-400">Relato</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-awk-blue-100">{incidencia.relato}</p>
      </div>

      {incidencia.resolucion && (
        <div className="rounded-lg border border-awk-cyan-700 bg-awk-navy-900 p-3">
          <p className="text-xs text-awk-cyan-400">Resolución</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-awk-blue-100">{incidencia.resolucion}</p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-awk-blue-100">Seguimiento ({incidencia.seguimientos.length})</h3>
        {incidencia.seguimientos.length === 0 ? (
          <p className="mt-2 text-sm text-awk-blue-400">Todavía no hay entradas de seguimiento.</p>
        ) : (
          <ul className="mt-2 space-y-2" data-testid="seguimientos-list">
            {incidencia.seguimientos.map((seguimiento) => (
              <li key={seguimiento.id} className="rounded-lg bg-awk-navy-900 p-2 text-sm">
                <p className="text-awk-blue-50">{seguimiento.texto}</p>
                <p className="mt-1 text-xs text-awk-blue-500">
                  {seguimiento.autorNombre ?? '—'} · {new Date(seguimiento.createdAt).toLocaleString('es-ES')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {actions?.(incidencia, onChanged)}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-awk-blue-400">{label}</p>
      <p className="mt-1 text-awk-blue-50">{value}</p>
    </div>
  );
}
