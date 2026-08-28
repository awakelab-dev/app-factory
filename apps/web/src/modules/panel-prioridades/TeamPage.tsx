import { useEffect, useState } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@awk/ui';
import { apiFetch } from '../../lib/api';
import { z } from 'zod';
import { panelTeamMemberSchema, type PanelTeamMember, type CreateTeamMemberRequest } from './panel-prioridades.types';

export function TeamPage() {
  const [members, setMembers] = useState<PanelTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateTeamMemberRequest>({ name: '', email: '' });

  useEffect(() => {
    loadTeam();
  }, []);

  async function loadTeam() {
    try {
      setLoading(true);
      const response = await apiFetch('/api/panel-prioridades/team', z.array(panelTeamMemberSchema));
      setMembers(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar equipo');
    } finally {
      setLoading(false);
    }
  }

  async function addMember() {
    if (!formData.name || !formData.email) {
      alert('Rellena nombre y email');
      return;
    }
    try {
      // El alta devuelve el miembro creado; aquí solo interesa que no falle.
      await apiFetch('/api/panel-prioridades/team', z.unknown(), {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setFormData({ name: '', email: '' });
      setShowForm(false);
      await loadTeam();
    } catch (err) {
      alert('Error al añadir miembro: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function removeMember(id: string) {
    if (!confirm('¿Desactivar este miembro?')) return;
    try {
      // DELETE responde 204 sin cuerpo: `z.unknown()` acepta el null que
      // devuelve apiFetch cuando no hay JSON que parsear.
      await apiFetch(`/api/panel-prioridades/team/${id}`, z.unknown(), { method: 'DELETE' });
      await loadTeam();
    } catch (err) {
      alert('Error al desactivar: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">
            Mi equipo <span className="text-awk-cyan-400">·</span> delegaciones
          </h1>
          <p className="mt-2 text-sm text-awk-blue-300">
            Personas a quienes delegas tareas (solo visible para ti)
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          Añadir miembro
        </Button>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-800 bg-red-900/20 p-4">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-awk-blue-700 bg-awk-navy-800 p-4 space-y-3">
          <input
            type="text"
            placeholder="Nombre"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full rounded border border-awk-blue-600 bg-awk-blue-900 px-3 py-2 text-white placeholder-awk-blue-500"
          />
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            className="w-full rounded border border-awk-blue-600 bg-awk-blue-900 px-3 py-2 text-white placeholder-awk-blue-500"
          />
          <div className="flex gap-2">
            <Button onClick={addMember} className="bg-awk-cyan-400">Guardar</Button>
            <Button onClick={() => setShowForm(false)} className="bg-awk-blue-700">Cancelar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-awk-blue-300">Cargando equipo…</p>
      ) : members.length === 0 ? (
        <p className="text-awk-blue-400">Sin miembros en el equipo aún</p>
      ) : (
        <div className="space-y-2">
          {members.filter(m => m.active).map(m => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-awk-blue-700 bg-awk-navy-800 p-4">
              <div>
                <p className="font-medium text-white">{m.name}</p>
                <p className="text-xs text-awk-blue-400">{m.email}</p>
              </div>
              <button
                onClick={() => removeMember(m.id)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
