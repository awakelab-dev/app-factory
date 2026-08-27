'use client';

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@awk/ui';
import { getKpis } from './panel-prioridades-api';
import type { PanelKpisResponse } from './panel-prioridades.types';

/**
 * MetricsPage: indicadores y diagnósticos automáticos.
 * Muestra KPIs del panel y alertas sobre carga de trabajo.
 */
export function MetricsPage() {
  const [kpis, setKpis] = useState<PanelKpisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getKpis()
      .then(setKpis)
      .catch(() => {}) // silenciar errores
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || !kpis) {
    return <div className="p-4">Cargando indicadores...</div>;
  }

  const diagnosticColors: Record<string, string> = {
    apagafuegos: 'bg-red-50 border-l-4 border-red-500',
    bien_orientada: 'bg-green-50 border-l-4 border-green-500',
    falta_fondo: 'bg-yellow-50 border-l-4 border-yellow-500',
    urgencias_sin_responsable: 'bg-orange-50 border-l-4 border-orange-500'
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Indicadores</h1>
          <p className="text-gray-600">Diagnósticos y métricas de carga</p>
        </div>
        <Link to="/panel-prioridades">
          <Button variant="outline">← Volver a Matriz</Button>
        </Link>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold">{kpis.openTasksCount}</p>
          <p className="text-sm text-gray-600">Tareas abiertas</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold">{Math.round(kpis.weekScheduledMinutes / 60)}h</p>
          <p className="text-sm text-gray-600">Semana agendada</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold">{kpis.q2PercentageMinutes}%</p>
          <p className="text-sm text-gray-600">Tiempo en Q2</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold">{kpis.overdueTasksCount}</p>
          <p className="text-sm text-gray-600">Vencidas</p>
        </div>
      </div>

      {/* Distribución por cuadrante */}
      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-3 font-bold">Tareas por cuadrante</h3>
        <div className="space-y-2">
          {kpis.tasksByQuadrant.map((item) => (
            <div key={item.quadrant} className="flex items-center justify-between">
              <span className="text-sm">Q{item.quadrant}</span>
              <div className="h-4 w-40 overflow-hidden rounded bg-gray-200">
                <div
                  className="h-full bg-blue-500"
                  style={{
                    width: `${
                      kpis.tasksByQuadrant.reduce((sum, q) => sum + q.taskCount, 0) > 0
                        ? (item.taskCount /
                            kpis.tasksByQuadrant.reduce((sum, q) => sum + q.taskCount, 0)) *
                          100
                        : 0
                    }%`
                  }}
                />
              </div>
              <span className="text-sm font-medium">{item.taskCount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Diagnósticos */}
      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-3 font-bold">Diagnósticos automáticos</h3>
        <div className="space-y-3">
          {kpis.diagnostics.length === 0 ? (
            <p className="text-gray-600">Sin diagnósticos por el momento.</p>
          ) : (
            kpis.diagnostics.map((diag, idx) => (
              <div
                key={idx}
                className={`rounded p-3 ${diagnosticColors[diag.type] || 'bg-gray-50'}`}
              >
                <p className="text-sm">{diag.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
