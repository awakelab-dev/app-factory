import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { z } from 'zod';
import { panelDelegationSchema, type PanelDelegation } from './panel-prioridades.types';

export function DelegationsPage() {
  const [delegations, setDelegations] = useState<PanelDelegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDelegations();
  }, []);

  async function loadDelegations() {
    try {
      setLoading(true);
      const response = await apiFetch('/api/panel-prioridades/delegations', z.array(panelDelegationSchema));
      setDelegations(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar delegaciones');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white">
          Delegaciones <span className="text-awk-cyan-400">·</span> seguimiento
        </h1>
        <p className="mt-2 text-sm text-awk-blue-300">
          Tareas que delegaste: estado y fechas de seguimiento
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-800 bg-red-900/20 p-4">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-awk-blue-300">Cargando delegaciones…</p>
      ) : delegations.length === 0 ? (
        <p className="text-awk-blue-400">Sin delegaciones registradas</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-awk-blue-700">
          <table className="w-full bg-awk-navy-800 text-left text-sm">
            <thead className="border-b border-awk-blue-700 bg-awk-navy-900">
              <tr>
                <th className="px-4 py-3 font-medium text-awk-blue-100">Tarea</th>
                <th className="px-4 py-3 font-medium text-awk-blue-100">Delegado a</th>
                <th className="px-4 py-3 font-medium text-awk-blue-100">Seguimiento</th>
                <th className="px-4 py-3 font-medium text-awk-blue-100">Estado</th>
              </tr>
            </thead>
            <tbody>
              {delegations.map(d => (
                <tr key={d.id} className="border-b border-awk-blue-800 hover:bg-awk-blue-800/20">
                  <td className="px-4 py-3 text-awk-blue-50">Tarea {d.taskId?.substring(0, 8)}</td>
                  <td className="px-4 py-3 text-awk-blue-300">{d.delegatedToName || '(sin asignar)'}</td>
                  <td className="px-4 py-3 text-awk-blue-300">
                    {d.followUpDate ? new Date(d.followUpDate).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={d.followUpOverdue ? 'text-red-400' : 'text-awk-green-400'}>
                      {d.followUpOverdue ? '⚠ Vencida' : '✓ En seguimiento'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
