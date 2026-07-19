import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  factoryGateSchema,
  factoryProjectDetailSchema,
  type FactoryGate,
  type FactoryGateDecision,
  type FactoryProjectDetail,
  type FactorySpec
} from '@awk/types';
import { apiFetch } from '../../lib/api';
import { SpecMarkdown } from './SpecMarkdown';
import {
  GATE_STATUS_LABEL,
  GATE_TYPE_LABEL,
  HAPPY_PATH,
  PROJECT_STATUS_LABEL,
  RUN_STATUS_LABEL,
  formatDateTime,
  statusBadgeClass
} from './pipeline-labels';

type DetailState =
  | { status: 'loading' }
  | { status: 'ok'; project: FactoryProjectDetail }
  | { status: 'error'; detail: string };

/**
 * Detalle de un proyecto del pipeline: timeline de estados (stepper del
 * camino feliz de docs/03), visor de la spec funcional/técnica con decisión
 * de gates (aprobar / pedir cambios / rechazar — docs/05) e historial de
 * specs, gates y runs. La única escritura es decidir gates; todo lo demás es
 * lectura (D-030).
 */
export function FactoryProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  const load = useCallback(() => {
    if (!projectId) return;
    apiFetch(`/factory-api/projects/${projectId}`, factoryProjectDetailSchema)
      .then((project) => setState({ status: 'ok', project }))
      .catch((err: unknown) =>
        setState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') {
    return <p className="text-awk-blue-300">Cargando proyecto…</p>;
  }

  if (state.status === 'error') {
    return (
      <p className="text-red-400" data-testid="factory-detail-error">
        No se pudo cargar el proyecto ({state.detail}).{' '}
        <Link to="/factory" className="text-awk-cyan-300 hover:text-awk-cyan-100">
          Volver a la lista
        </Link>
      </p>
    );
  }

  const { project } = state;

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/factory" className="text-sm text-awk-blue-400 hover:text-awk-cyan-300">
        ← Proyectos
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold text-white">{project.displayName}</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs ${statusBadgeClass(project.status)}`}
          data-testid="factory-project-status"
        >
          {PROJECT_STATUS_LABEL[project.status]}
        </span>
      </div>
      <p className="mt-2 text-awk-blue-300">
        <code className="text-awk-cyan-100">{project.moduleSlug}</code> · solicitado por{' '}
        {project.requestedBy} · creado el {formatDateTime(project.createdAt)}
      </p>
      <p className="mt-1 text-sm text-awk-blue-400">Fuente: {project.sourceRef}</p>

      <PipelineStepper status={project.status} />
      <SpecSection specs={project.specs} onGateDecided={load} />
      <HistorySection project={project} />
    </div>
  );
}

/** Stepper del camino feliz; los estados de desvío se muestran como alerta. */
function PipelineStepper({ status }: { status: FactoryProjectDetail['status'] }) {
  const happyIndex = HAPPY_PATH.indexOf(status as (typeof HAPPY_PATH)[number]);
  const isDetour = happyIndex === -1;

  return (
    <section className="mt-8" data-testid="factory-stepper">
      <h2 className="text-lg font-semibold text-white">Pipeline</h2>
      <ol className="mt-3 flex flex-wrap gap-y-3">
        {HAPPY_PATH.map((step, index) => {
          const done = !isDetour && index < happyIndex;
          const current = !isDetour && index === happyIndex;
          return (
            <li key={step} className="flex items-center">
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  current
                    ? 'bg-awk-cyan-500 font-semibold text-awk-navy-900'
                    : done
                      ? 'bg-awk-blue-800 text-awk-cyan-300'
                      : 'bg-awk-navy-800 text-awk-blue-400'
                }`}
              >
                {PROJECT_STATUS_LABEL[step]}
              </span>
              {step !== HAPPY_PATH[HAPPY_PATH.length - 1] && (
                <span className="mx-1 text-awk-blue-700">→</span>
              )}
            </li>
          );
        })}
      </ol>
      {isDetour && (
        <p
          className={`mt-3 rounded-lg border p-3 text-sm ${
            status === 'changes_requested'
              ? 'border-amber-800 bg-amber-950 text-amber-400'
              : 'border-red-800 bg-red-950 text-red-400'
          }`}
          data-testid="factory-detour"
        >
          Estado actual: {PROJECT_STATUS_LABEL[status]} — fuera del camino feliz. Ver historial y
          gates para el motivo.
        </p>
      )}
    </section>
  );
}

/** Visor de spec (funcional/técnica) con selector de versión y decisión de gates. */
function SpecSection({ specs, onGateDecided }: { specs: FactorySpec[]; onGateDecided: () => void }) {
  // specs llega ordenada por versión desc (getFullStatus) — la [0] es la vigente.
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [tab, setTab] = useState<'functional' | 'technical'>('functional');
  const spec = useMemo(
    () => specs.find((candidate) => candidate.id === selectedSpecId) ?? specs[0] ?? null,
    [specs, selectedSpecId]
  );

  if (!spec) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-white">Spec</h2>
        <p className="mt-3 rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6 text-awk-blue-300">
          Sin spec todavía — corre el análisis por CLI (<code className="text-awk-cyan-100">analyze</code>).
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8" data-testid="factory-spec">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-white">Spec</h2>
        {specs.length > 1 && (
          <select
            className="rounded-lg border border-awk-blue-700 bg-awk-navy-800 px-2 py-1 text-sm text-awk-blue-50"
            value={spec.id}
            onChange={(event) => setSelectedSpecId(event.target.value)}
            aria-label="Versión de la spec"
          >
            {specs.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                v{candidate.version} — {formatDateTime(candidate.createdAt)}
              </option>
            ))}
          </select>
        )}
        {specs.length === 1 && (
          <span className="text-sm text-awk-blue-400">
            v{spec.version} — {formatDateTime(spec.createdAt)}
          </span>
        )}
        {spec.complexityScore !== null && (
          <span className="rounded-full bg-awk-blue-800 px-2 py-0.5 text-xs text-awk-cyan-300">
            complejidad {spec.complexityScore}/5
          </span>
        )}
        {spec.sensitivityFlags.map((flag) => (
          <span key={flag} className="rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-400">
            {flag}
          </span>
        ))}
      </div>

      {spec.reuseNotes && (
        <p className="mt-3 rounded-lg border border-awk-blue-700 bg-awk-navy-800 p-3 text-sm text-awk-blue-300">
          <span className="font-medium text-awk-cyan-300">Reutilización:</span> {spec.reuseNotes}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {(['functional', 'technical'] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => setTab(candidate)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === candidate
                ? 'bg-awk-cyan-500 font-semibold text-awk-navy-900'
                : 'bg-awk-navy-800 text-awk-blue-300 hover:text-awk-cyan-300'
            }`}
          >
            {candidate === 'functional' ? 'Funcional (negocio)' : 'Técnica'}
          </button>
        ))}
      </div>
      <SpecMarkdown content={tab === 'functional' ? spec.functionalContent : spec.technicalContent} />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {spec.gates.map((gate) => (
          <GateCard key={gate.id} gate={gate} onDecided={onGateDecided} />
        ))}
      </div>
    </section>
  );
}

function GateCard({ gate, onDecided }: { gate: FactoryGate; onDecided: () => void }) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState<FactoryGateDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: FactoryGateDecision) {
    setSubmitting(decision);
    setError(null);
    try {
      await apiFetch(`/factory-api/gates/${gate.id}/decision`, factoryGateSchema, {
        method: 'POST',
        body: JSON.stringify({ decision, notes: notes.trim() || undefined })
      });
      onDecided();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(null);
    }
  }

  return (
    <div
      className="rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-4"
      data-testid={`factory-gate-${gate.gateType}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-awk-blue-50">{GATE_TYPE_LABEL[gate.gateType]}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            gate.status === 'approved'
              ? 'bg-awk-cyan-900/40 text-awk-cyan-300'
              : gate.status === 'pending'
                ? 'bg-awk-blue-800 text-awk-blue-300'
                : gate.status === 'rejected'
                  ? 'bg-red-950 text-red-400'
                  : 'bg-amber-950 text-amber-400'
          }`}
        >
          {GATE_STATUS_LABEL[gate.status]}
        </span>
      </div>

      {gate.status !== 'pending' ? (
        <div className="mt-2 text-sm text-awk-blue-300">
          <p>
            {gate.reviewer ?? '—'}
            {gate.decidedAt ? ` · ${formatDateTime(gate.decidedAt)}` : ''}
          </p>
          {gate.decisionNotes && <p className="mt-1 text-awk-blue-400">“{gate.decisionNotes}”</p>}
        </div>
      ) : (
        <div className="mt-3">
          <textarea
            className="w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 p-2 text-sm text-awk-blue-50 placeholder:text-awk-blue-500"
            rows={2}
            placeholder="Comentario (obligatorio para rechazar o pedir cambios)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            aria-label={`Comentario para ${GATE_TYPE_LABEL[gate.gateType]}`}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => void decide('approved')}
              className="rounded-lg bg-awk-cyan-500 px-3 py-1.5 text-sm font-semibold text-awk-navy-900 hover:bg-awk-cyan-400 disabled:opacity-50"
            >
              {submitting === 'approved' ? 'Aprobando…' : 'Aprobar'}
            </button>
            <button
              type="button"
              disabled={submitting !== null || notes.trim() === ''}
              onClick={() => void decide('changes_requested')}
              className="rounded-lg border border-amber-800 bg-amber-950 px-3 py-1.5 text-sm text-amber-400 hover:border-amber-600 disabled:opacity-50"
            >
              Pedir cambios
            </button>
            <button
              type="button"
              disabled={submitting !== null || notes.trim() === ''}
              onClick={() => void decide('rejected')}
              className="rounded-lg border border-red-800 bg-red-950 px-3 py-1.5 text-sm text-red-400 hover:border-red-600 disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-400" data-testid="factory-gate-error">
              No se pudo registrar la decisión ({error}).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface HistoryEvent {
  at: string;
  text: string;
  tone: 'neutral' | 'ok' | 'warn' | 'error';
}

/** Historial cronológico (desc) reconstruido de specs, gates y runs — no hay tabla de eventos propia. */
function HistorySection({ project }: { project: FactoryProjectDetail }) {
  const events = useMemo<HistoryEvent[]>(() => {
    const list: HistoryEvent[] = [
      { at: project.createdAt, text: `Proyecto creado por ${project.requestedBy}`, tone: 'neutral' }
    ];
    for (const spec of project.specs) {
      list.push({ at: spec.createdAt, text: `Spec v${spec.version} generada`, tone: 'neutral' });
      for (const gate of spec.gates) {
        if (gate.status !== 'pending' && gate.decidedAt) {
          list.push({
            at: gate.decidedAt,
            text: `${GATE_TYPE_LABEL[gate.gateType]} (spec v${spec.version}): ${GATE_STATUS_LABEL[gate.status].toLowerCase()} por ${gate.reviewer ?? '—'}${gate.decisionNotes ? ` — “${gate.decisionNotes}”` : ''}`,
            tone: gate.status === 'approved' ? 'ok' : gate.status === 'rejected' ? 'error' : 'warn'
          });
        }
      }
    }
    for (const run of project.runs) {
      const kind = run.runType === 'analysis' ? 'Análisis' : 'Generación';
      list.push({
        at: run.finishedAt ?? run.startedAt ?? run.createdAt,
        text: `${kind} (${RUN_STATUS_LABEL[run.status]})${run.branchName ? ` · rama ${run.branchName}` : ''}${run.prUrl ? ` · ${run.prUrl}` : ''}${run.costUsd !== null ? ` · $${run.costUsd.toFixed(2)}` : ''}${run.errorMessage ? ` — ${run.errorMessage}` : ''}`,
        tone: run.status === 'error' ? 'error' : run.status === 'success' ? 'ok' : 'neutral'
      });
    }
    return list.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [project]);

  return (
    <section className="mt-8" data-testid="factory-history">
      <h2 className="text-lg font-semibold text-white">Historial</h2>
      <ol className="mt-3 space-y-2">
        {events.map((event, index) => (
          <li
            key={`${event.at}-${index}`}
            className="rounded-lg border border-awk-blue-800 bg-awk-navy-800 px-4 py-2 text-sm"
          >
            <span className="mr-3 font-mono text-xs text-awk-blue-400">{formatDateTime(event.at)}</span>
            <span
              className={
                event.tone === 'ok'
                  ? 'text-awk-cyan-300'
                  : event.tone === 'error'
                    ? 'text-red-400'
                    : event.tone === 'warn'
                      ? 'text-amber-400'
                      : 'text-awk-blue-50'
              }
            >
              {event.text}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
