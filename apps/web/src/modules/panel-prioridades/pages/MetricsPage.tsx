import React, { useEffect, useState } from 'react';
import { getKPIs } from '../panel-prioridades-api';
import type { KPIs } from '../panel-prioridades.types';

/**
 * MetricsPage: indicadores (KPIs) y diagnósticos automáticos.
 */
export default function MetricsPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getKPIs();
      setKpis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar indicadores');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;
  if (!kpis) return <div className="p-8">Sin datos</div>;

  const severityBg = {
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200',
    critical: 'bg-red-50 border-red-200'
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Indicadores y Diagnósticos</h1>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-6 text-center border rounded-lg bg-white">
          <p className="text-gray-600 text-sm mb-1">Tareas Abiertas</p>
          <p className="text-3xl font-bold">{kpis.totalOpen}</p>
        </div>

        <div className="p-6 text-center border rounded-lg bg-white">
          <p className="text-gray-600 text-sm mb-1">Horas Agendadas</p>
          <p className="text-3xl font-bold">{kpis.totalHoursScheduled}</p>
        </div>

        <div className="p-6 text-center border rounded-lg bg-white">
          <p className="text-gray-600 text-sm mb-1">% en Q2</p>
          <p className="text-3xl font-bold">{kpis.percentageQ2}%</p>
        </div>

        <div className="p-6 text-center border rounded-lg bg-white">
          <p className="text-gray-600 text-sm mb-1">Vencidas</p>
          <p className="text-3xl font-bold text-red-600">{kpis.overdueCount}</p>
        </div>
      </div>

      {/* Distribution by Quadrant */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-6 border rounded-lg bg-white">
          <h3 className="font-semibold mb-4">Tareas por Cuadrante</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Q1 (Hacer)</span>
                <span className="font-bold">{kpis.tasksByQuadrant.q1}</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-2">
                <div
                  className="bg-red-500 h-2 rounded"
                  style={{
                    width: `${
                      kpis.tasksByQuadrant.q1 > 0
                        ? (kpis.tasksByQuadrant.q1 / kpis.totalOpen) * 100
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Q2 (Planificar)</span>
                <span className="font-bold">{kpis.tasksByQuadrant.q2}</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-2">
                <div
                  className="bg-green-500 h-2 rounded"
                  style={{
                    width: `${
                      kpis.tasksByQuadrant.q2 > 0
                        ? (kpis.tasksByQuadrant.q2 / kpis.totalOpen) * 100
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Q3 (Delegar)</span>
                <span className="font-bold">{kpis.tasksByQuadrant.q3}</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-2">
                <div
                  className="bg-yellow-500 h-2 rounded"
                  style={{
                    width: `${
                      kpis.tasksByQuadrant.q3 > 0
                        ? (kpis.tasksByQuadrant.q3 / kpis.totalOpen) * 100
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Q4 (Eliminar)</span>
                <span className="font-bold">{kpis.tasksByQuadrant.q4}</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-2">
                <div
                  className="bg-gray-500 h-2 rounded"
                  style={{
                    width: `${
                      kpis.tasksByQuadrant.q4 > 0
                        ? (kpis.tasksByQuadrant.q4 / kpis.totalOpen) * 100
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border rounded-lg bg-white">
          <h3 className="font-semibold mb-4">Tiempo por Cuadrante</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Q1 (Hacer)</span>
                <span className="font-bold">{kpis.hoursByQuadrant.q1}h</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-2">
                <div
                  className="bg-red-500 h-2 rounded"
                  style={{
                    width: `${
                      kpis.totalHoursScheduled > 0
                        ? (kpis.hoursByQuadrant.q1 / kpis.totalHoursScheduled) * 100
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Q2 (Planificar)</span>
                <span className="font-bold">{kpis.hoursByQuadrant.q2}h</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-2">
                <div
                  className="bg-green-500 h-2 rounded"
                  style={{
                    width: `${
                      kpis.totalHoursScheduled > 0
                        ? (kpis.hoursByQuadrant.q2 / kpis.totalHoursScheduled) * 100
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Q3 (Delegar)</span>
                <span className="font-bold">{kpis.hoursByQuadrant.q3}h</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-2">
                <div
                  className="bg-yellow-500 h-2 rounded"
                  style={{
                    width: `${
                      kpis.totalHoursScheduled > 0
                        ? (kpis.hoursByQuadrant.q3 / kpis.totalHoursScheduled) * 100
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Q4 (Eliminar)</span>
                <span className="font-bold">{kpis.hoursByQuadrant.q4}h</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-2">
                <div
                  className="bg-gray-500 h-2 rounded"
                  style={{
                    width: `${
                      kpis.totalHoursScheduled > 0
                        ? (kpis.hoursByQuadrant.q4 / kpis.totalHoursScheduled) * 100
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Diagnósticos Automáticos</h2>
        <div className="space-y-3">
          {kpis.diagnostics.map((diag, idx) => (
            <div
              key={idx}
              className={`p-4 border-l-4 border rounded-lg ${
                severityBg[diag.severity as keyof typeof severityBg]
              }`}
            >
              <p className="text-sm">{diag.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
