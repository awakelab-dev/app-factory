import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { panelKpisResponseSchema, type PanelKpisResponse } from './panel-prioridades.types';

export function MetricsPage() {
  const [metrics, setMetrics] = useState<PanelKpisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    try {
      setLoading(true);
      const response = await apiFetch('/api/panel-prioridades/kpis', panelKpisResponseSchema);
      setMetrics(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar métricas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white">
          Indicadores <span className="text-awk-cyan-400">·</span> diagnóstico
        </h1>
        <p className="mt-2 text-sm text-awk-blue-300">
          KPIs y diagnósticos automáticos sobre tu carga de trabajo
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-800 bg-red-900/20 p-4">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-awk-blue-300">Cargando métricas…</p>
      ) : metrics ? (
        <div className="space-y-6">
          {/* KPI Tiles */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-lg border border-awk-blue-700 bg-awk-navy-800 p-4">
              <p className="text-xs uppercase text-awk-blue-400">Tareas abiertas</p>
              <p className="mt-2 text-2xl font-bold text-white">{metrics.openTasksCount}</p>
            </div>
            <div className="rounded-lg border border-awk-blue-700 bg-awk-navy-800 p-4">
              <p className="text-xs uppercase text-awk-blue-400">Horas reservadas</p>
              <p className="mt-2 text-2xl font-bold text-awk-cyan-400">{(metrics.weekScheduledMinutes / 60).toFixed(1)}h</p>
            </div>
            <div className="rounded-lg border border-awk-blue-700 bg-awk-navy-800 p-4">
              <p className="text-xs uppercase text-awk-blue-400">Q2 (fondo)</p>
              <p className="mt-2 text-2xl font-bold text-awk-green-400">{metrics.q2PercentageMinutes}%</p>
            </div>
            <div className="rounded-lg border border-awk-blue-700 bg-awk-navy-800 p-4">
              <p className="text-xs uppercase text-awk-blue-400">Vencidas</p>
              <p className="mt-2 text-2xl font-bold text-red-400">{metrics.overdueTasksCount}</p>
            </div>
          </div>

          {/* Diagnostics */}
          {metrics.diagnostics && metrics.diagnostics.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-awk-blue-100">Diagnósticos automáticos</h3>
              {metrics.diagnostics.map((d: { message: string }, idx: number) => (
                <div key={idx} className="rounded-lg border-l-4 border-awk-cyan-400 bg-awk-blue-800/40 p-3 pl-4">
                  <p className="text-sm text-awk-blue-50">{d.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
