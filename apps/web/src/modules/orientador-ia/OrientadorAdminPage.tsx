import { useEffect, useState } from 'react';
import {
  orientadorAcademiesResponseSchema,
  orientadorAcademySchema,
  orientadorLeadsResponseSchema,
  type OrientadorAcademy,
  type OrientadorAcademyUpdate,
  type OrientadorLeadRow
} from '@awk/types';
import { Download, Pencil, X } from 'lucide-react';
import { Button } from '@awk/ui';
import { apiFetch, apiFetchBlob, ApiError } from '../../lib/api';
import { LEVEL_LABELS, SECTOR_LABELS } from './sector-labels';

type Tab = 'leads' | 'academies';

type LeadsState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; leads: OrientadorLeadRow[] };

type AcademiesState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; academies: OrientadorAcademy[] };

/**
 * Panel admin de orientador-ia (rol `orientador_admin`, D-025): leads
 * capturados por el flujo del candidato y catálogo editable de "academias"
 * (contenido comercial de Refactika, D-025 — se mantiene tal cual salvo
 * ediciones puntuales que el propio admin de Aspasia haga aquí).
 */
export function OrientadorAdminPage() {
  const [tab, setTab] = useState<Tab>('leads');
  const [leadsState, setLeadsState] = useState<LeadsState>({ status: 'loading' });
  const [academiesState, setAcademiesState] = useState<AcademiesState>({ status: 'loading' });
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/orientador-ia/admin/leads', orientadorLeadsResponseSchema)
      .then((leads) => setLeadsState({ status: 'ok', leads }))
      .catch((err: unknown) =>
        setLeadsState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
    apiFetch('/api/orientador-ia/admin/academies', orientadorAcademiesResponseSchema)
      .then((academies) => setAcademiesState({ status: 'ok', academies }))
      .catch((err: unknown) =>
        setAcademiesState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, []);

  async function onExport() {
    setExportError(null);
    try {
      const blob = await apiFetchBlob('/api/orientador-ia/admin/leads/export');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'orientador-ia-leads.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    }
  }

  function onAcademyUpdated(updated: OrientadorAcademy) {
    setAcademiesState((prev) =>
      prev.status === 'ok'
        ? { status: 'ok', academies: prev.academies.map((a) => (a.id === updated.id ? updated : a)) }
        : prev
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold text-white">
        Orientador IA <span className="text-awk-cyan-400">·</span> panel admin
      </h1>
      <p className="mt-2 text-awk-blue-300">
        Leads del flujo de orientación y catálogo de academias (Grupo Aspasia/Refactika).
      </p>

      <div className="mt-6 flex gap-2">
        <TabButton label={`Leads`} active={tab === 'leads'} onClick={() => setTab('leads')} />
        <TabButton label="Academias" active={tab === 'academies'} onClick={() => setTab('academies')} />
      </div>

      {tab === 'leads' && (
        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-awk-blue-300">
              {leadsState.status === 'ok' ? `${leadsState.leads.length} leads` : ''}
            </p>
            <Button onClick={() => void onExport()} data-testid="export-button">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
          {exportError && (
            <p className="mb-3 text-sm text-red-400" data-testid="export-error">
              {exportError}
            </p>
          )}
          <LeadsTable state={leadsState} />
        </section>
      )}

      {tab === 'academies' && (
        <section className="mt-6">
          <AcademiesList state={academiesState} onUpdated={onAcademyUpdated} />
        </section>
      )}
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm transition-colors ${
        active ? 'bg-awk-blue-700 text-awk-cyan-300' : 'text-awk-blue-100 hover:bg-awk-blue-800'
      }`}
    >
      {label}
    </button>
  );
}

function LeadsTable({ state }: { state: LeadsState }) {
  if (state.status === 'loading') return <p className="text-awk-blue-300">Cargando leads…</p>;
  if (state.status === 'error') {
    return (
      <p className="text-red-400" data-testid="leads-error">
        No se pudo cargar la lista ({state.detail}).
      </p>
    );
  }
  if (state.leads.length === 0) {
    return (
      <p className="rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6 text-sm text-awk-blue-400">
        Todavía no hay leads capturados.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-awk-blue-700">
      <div className="max-h-[520px] overflow-y-auto">
        <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid="leads-table">
          <thead className="sticky top-0 bg-awk-navy-800">
            <tr className="border-b border-awk-blue-700 text-xs uppercase tracking-wide text-awk-blue-400">
              <th className="px-4 py-2 font-medium">Candidato</th>
              <th className="px-4 py-2 font-medium">Contacto</th>
              <th className="px-4 py-2 font-medium">Origen</th>
              <th className="px-4 py-2 font-medium">Sector recomendado</th>
              <th className="px-4 py-2 font-medium">Nivel</th>
              <th className="px-4 py-2 text-right font-medium">Análisis</th>
            </tr>
          </thead>
          <tbody>
            {state.leads.map((lead) => (
              <tr key={lead.id} className="border-b border-awk-blue-800 last:border-0">
                <td className="px-4 py-2">
                  <p className="text-awk-blue-50">{lead.fullName}</p>
                  <p className="text-xs text-awk-blue-400">{new Date(lead.createdAt).toLocaleString('es-ES')}</p>
                </td>
                <td className="px-4 py-2 text-awk-blue-300">
                  <p>{lead.email}</p>
                  {lead.phone && <p className="text-xs text-awk-blue-400">{lead.phone}</p>}
                </td>
                <td className="px-4 py-2 text-awk-blue-300">{lead.rawInputType}</td>
                <td className="px-4 py-2 text-awk-blue-100">
                  {lead.profile ? SECTOR_LABELS[lead.profile.recommendedSector] : '—'}
                </td>
                <td className="px-4 py-2 text-awk-blue-100">
                  {lead.profile ? LEVEL_LABELS[lead.profile.estimatedLevel] : '—'}
                </td>
                <td className="px-4 py-2 text-right text-awk-blue-100">{lead.analysisCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AcademiesList({
  state,
  onUpdated
}: {
  state: AcademiesState;
  onUpdated: (academy: OrientadorAcademy) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (state.status === 'loading') return <p className="text-awk-blue-300">Cargando academias…</p>;
  if (state.status === 'error') {
    return (
      <p className="text-red-400" data-testid="academies-error">
        No se pudo cargar el catálogo ({state.detail}).
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="academies-list">
      {state.academies.map((academy) =>
        editingId === academy.id ? (
          <AcademyEditForm
            key={academy.id}
            academy={academy}
            onCancel={() => setEditingId(null)}
            onSaved={(updated) => {
              onUpdated(updated);
              setEditingId(null);
            }}
          />
        ) : (
          <div
            key={academy.id}
            className="flex items-center justify-between rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-4"
          >
            <div>
              <p className="text-awk-blue-50">
                {academy.name}{' '}
                <span className={academy.active ? 'text-awk-cyan-400' : 'text-awk-blue-500'}>
                  ({academy.active ? 'activa' : 'inactiva'})
                </span>
              </p>
              <p className="text-xs text-awk-blue-400">
                {SECTOR_LABELS[academy.sector]} · {academy.duration} · {academy.priceEur}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditingId(academy.id)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          </div>
        )
      )}
    </div>
  );
}

const editableFieldClass =
  'w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none';

function AcademyEditForm({
  academy,
  onCancel,
  onSaved
}: {
  academy: OrientadorAcademy;
  onCancel: () => void;
  onSaved: (academy: OrientadorAcademy) => void;
}) {
  const [form, setForm] = useState({
    name: academy.name,
    shortName: academy.shortName,
    duration: academy.duration,
    durationWeeks: String(academy.durationWeeks),
    challenge: academy.challenge,
    modules: academy.modules.join('\n'),
    outcomes: academy.outcomes.join('\n'),
    priceEur: academy.priceEur,
    priceUsd: academy.priceUsd,
    purchaseUrl: academy.purchaseUrl,
    active: academy.active
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const patch: OrientadorAcademyUpdate = {
        name: form.name,
        shortName: form.shortName,
        duration: form.duration,
        durationWeeks: Number(form.durationWeeks) || academy.durationWeeks,
        challenge: form.challenge,
        modules: form.modules.split('\n').map((s) => s.trim()).filter(Boolean),
        outcomes: form.outcomes.split('\n').map((s) => s.trim()).filter(Boolean),
        priceEur: form.priceEur,
        priceUsd: form.priceUsd,
        purchaseUrl: form.purchaseUrl,
        active: form.active
      };
      const raw = await apiFetch(
        `/api/orientador-ia/admin/academies/${academy.id}`,
        orientadorAcademySchema,
        { method: 'PUT', body: JSON.stringify(patch) }
      );
      onSaved(raw);
    } catch (err) {
      setError(
        err instanceof ApiError ? `No se pudo guardar (HTTP ${err.status}).` : 'No se pudo guardar el cambio.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-awk-cyan-700 bg-awk-navy-800 p-4" data-testid="academy-edit-form">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-awk-cyan-300">Editando: {academy.name}</p>
        <button type="button" onClick={onCancel} className="text-awk-blue-400 hover:text-awk-blue-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <LabeledInput label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <LabeledInput
          label="Nombre corto"
          value={form.shortName}
          onChange={(v) => setForm({ ...form, shortName: v })}
        />
        <LabeledInput
          label="Duración"
          value={form.duration}
          onChange={(v) => setForm({ ...form, duration: v })}
        />
        <LabeledInput
          label="Semanas"
          value={form.durationWeeks}
          onChange={(v) => setForm({ ...form, durationWeeks: v })}
        />
        <LabeledInput
          label="Precio (EUR)"
          value={form.priceEur}
          onChange={(v) => setForm({ ...form, priceEur: v })}
        />
        <LabeledInput
          label="Precio (USD)"
          value={form.priceUsd}
          onChange={(v) => setForm({ ...form, priceUsd: v })}
        />
        <div className="col-span-2">
          <LabeledInput
            label="URL de compra"
            value={form.purchaseUrl}
            onChange={(v) => setForm({ ...form, purchaseUrl: v })}
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-awk-blue-400">Reto final</label>
          <textarea
            rows={2}
            value={form.challenge}
            onChange={(e) => setForm({ ...form, challenge: e.target.value })}
            className={editableFieldClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-awk-blue-400">Módulos (uno por línea)</label>
          <textarea
            rows={4}
            value={form.modules}
            onChange={(e) => setForm({ ...form, modules: e.target.value })}
            className={editableFieldClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-awk-blue-400">Resultados (uno por línea)</label>
          <textarea
            rows={4}
            value={form.outcomes}
            onChange={(e) => setForm({ ...form, outcomes: e.target.value })}
            className={editableFieldClass}
          />
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm text-awk-blue-100">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Activa (visible para el candidato)
        </label>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => void onSave()} disabled={saving} data-testid="academy-save-button">
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-awk-blue-400">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={editableFieldClass} />
    </div>
  );
}
