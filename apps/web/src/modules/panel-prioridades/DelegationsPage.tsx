'use client';

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@awk/ui';
import { listDelegations } from './panel-prioridades-api';
import type { PanelDelegation } from './panel-prioridades.types';

/**
 * DelegationsPage: tabla de tareas delegadas (cuadrante 3).
 * Muestra responsables asignados, fechas de seguimiento y estado de vencimiento.
 */
export function DelegationsPage() {
  const [delegations, setDelegations] = useState<PanelDelegation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listDelegations()
      .then(setDelegations)
      .catch(() => {}) // silenciar errores
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Delegaciones</h1>
          <p className="text-gray-600">Tareas urgentes asignadas al equipo</p>
        </div>
        <Link to="/panel-prioridades">
          <Button variant="outline">← Volver a Matriz</Button>
        </Link>
      </div>

      {/* Tabla de delegaciones */}
      <div className="rounded-lg border border-gray-200 p-4">
        {isLoading ? (
          <p className="text-gray-600">Cargando...</p>
        ) : delegations.length === 0 ? (
          <p className="text-gray-600">Sin delegaciones por el momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Tarea</th>
                  <th className="p-2 text-left">Delegado a</th>
                  <th className="p-2 text-left">Seguimiento</th>
                  <th className="p-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {delegations.map((deleg) => (
                  <tr key={deleg.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <p className="font-medium">{deleg.taskId}</p>
                    </td>
                    <td className="p-2">{deleg.delegatedToName || '—'}</td>
                    <td className="p-2">
                      {deleg.followUpDate ? (
                        <span className={deleg.followUpOverdue ? 'text-red-600 font-bold' : ''}>
                          {new Date(deleg.followUpDate).toLocaleDateString('es-ES')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-2">
                      {deleg.followUpOverdue && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Seguimiento vencido
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
