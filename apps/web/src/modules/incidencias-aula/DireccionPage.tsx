import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CalendarClock, Inbox, ListChecks } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch } from '../../lib/api';
import { resumenMensualSchema, type ResumenMensual } from './incidencias-aula.types';
import { ESTADO_ACCENT, ESTADO_LABEL, GRAVEDAD_LABEL, TIPO_LABEL } from './incidencias-labels';

// Colores hex directos (no clases Tailwind): recharts los inyecta como
// atributos SVG (stroke/fill), mismo motivo que en moodle-insights.
const CHART_GRID = '#27334f';
const CHART_AXIS = '#72a3c4';
const CHART_TOOLTIP_STYLE = {
  background: '#012142',
  border: '1px solid #314668',
  color: '#f0f3fc',
  fontSize: 12
};
const CHART_CURSOR = { fill: 'rgba(39, 51, 79, 0.4)' };

type State = { status: 'loading' } | { status: 'error'; detail: string } | { status: 'ok'; resumen: ResumenMensual };

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Resumen mensual de Dirección (spec-tecnica.md `incidencias-aula`, rol
 * `incidencias_direccion`): SOLO agregados — el backend construye esta
 * respuesta con un mapper que nunca instancia `alumnoNombre`/`relato`/
 * `seguimientos` (gate funcional decisión 2 / gate técnico nota 5), así que
 * esta página no tiene ningún dato identificativo que ocultar: no existe la
 * columna, no hay nada que "no pintar".
 */
export function DireccionPage() {
  const [mes, setMes] = useState(currentMonth());
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    setState({ status: 'loading' });
    apiFetch(`/api/incidencias-aula/resumen-mensual?mes=${mes}`, resumenMensualSchema)
      .then((resumen) => setState({ status: 'ok', resumen }))
      .catch((err: unknown) => setState({ status: 'error', detail: err instanceof Error ? err.message : String(err) }));
  }, [mes]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold text-white">
            Incidencias de Aula <span className="text-awk-cyan-400">·</span> resumen mensual
          </h1>
          <p className="mt-2 text-sm text-awk-blue-300">
            Volumen, tiempos de cierre y distribución del mes — sin alumno ni relato.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-awk-blue-400">Mes</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 focus:border-awk-cyan-500 focus:outline-none"
            data-testid="mes-input"
          />
        </div>
      </header>

      {state.status === 'loading' && <p className="text-awk-blue-300">Cargando…</p>}
      {state.status === 'error' && (
        <p className="text-red-400" data-testid="resumen-error">
          No se pudo cargar el resumen ({state.detail}).
        </p>
      )}
      {state.status === 'ok' && <ResumenBody resumen={state.resumen} />}
    </div>
  );
}

function ResumenBody({ resumen }: { resumen: ResumenMensual }) {
  return (
    <>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Inbox} label="Incidencias totales" value={resumen.total} />
        <KpiCard icon={ListChecks} label="Abiertas / en curso" value={resumen.abiertas} />
        <KpiCard icon={AlertTriangle} label="Gravedad alta" value={resumen.gravedadAlta} accent="text-red-400" />
        <KpiCard
          icon={CalendarClock}
          label="Días medios hasta cierre"
          value={resumen.diasMediosHastaCierre ?? '—'}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Distribución por tipo">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={resumen.porTipo.map((d) => ({ label: TIPO_LABEL[d.tipo], count: d.count }))}
              margin={{ left: 8, right: 8 }}
            >
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="label" stroke={CHART_AXIS} fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis stroke={CHART_AXIS} fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} />
              <Bar dataKey="count" name="Incidencias" fill="#0fced3" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución por aula">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={resumen.porAula.map((d) => ({ label: d.aulaNombre, count: d.count }))}
              margin={{ left: 8, right: 8 }}
            >
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="label" stroke={CHART_AXIS} fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis stroke={CHART_AXIS} fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} />
              <Bar dataKey="count" name="Incidencias" fill="#11eaea" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-awk-blue-100">Detalle del mes ({resumen.detalle.length})</h2>
        {resumen.detalle.length === 0 ? (
          <p className="rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6 text-sm text-awk-blue-400">
            No hay incidencias registradas este mes.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-awk-blue-700">
            <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid="resumen-detalle-table">
              <thead>
                <tr className="border-b border-awk-blue-700 text-xs uppercase tracking-wide text-awk-blue-400">
                  <th className="px-4 py-2 font-medium">Referencia</th>
                  <th className="px-4 py-2 font-medium">Aula</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Gravedad</th>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 text-right font-medium">Días hasta cierre</th>
                </tr>
              </thead>
              <tbody>
                {resumen.detalle.map((fila) => (
                  <tr key={fila.id} className="border-b border-awk-blue-800 last:border-0">
                    <td className="px-4 py-2 font-mono text-xs text-awk-blue-400">{fila.id.slice(0, 8)}</td>
                    <td className="px-4 py-2 text-awk-blue-300">{fila.aulaNombre}</td>
                    <td className="px-4 py-2 text-awk-blue-300">{TIPO_LABEL[fila.tipo]}</td>
                    <td className="px-4 py-2 text-awk-blue-300">{GRAVEDAD_LABEL[fila.gravedad]}</td>
                    <td className="px-4 py-2 text-awk-blue-300">{fila.fechaHecho}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${ESTADO_ACCENT[fila.estado]}`}>
                        {ESTADO_LABEL[fila.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-awk-blue-100">{fila.diasHastaCierre ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-4">
      <h2 className="mb-2 text-sm font-medium text-awk-blue-100">{title}</h2>
      {children}
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
  value: number | string;
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
