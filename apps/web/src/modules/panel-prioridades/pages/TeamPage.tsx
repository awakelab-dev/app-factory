import React, { useEffect, useState } from 'react';
import { getTeam, addTeamMember, deleteTeamMember } from '../panel-prioridades-api';
import type { TeamMember } from '../panel-prioridades.types';
import { Button } from '@awk/ui';

/**
 * TeamPage: gestión del equipo local (personas a quienes delegar).
 */
export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTeam();
      setTeam(result.team);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar equipo');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      setError('Nombre y email requeridos');
      return;
    }

    setAdding(true);
    setError(null);
    try {
      await addTeamMember({ name: newName, email: newEmail });
      setNewName('');
      setNewEmail('');
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al añadir miembro');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este miembro?')) return;
    setError(null);
    try {
      await deleteTeamMember(id);
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desactivar');
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;

  const activeTeam = team.filter(m => m.active);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Equipo</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Add Team Member */}
      <div className="mb-8 p-6 border rounded-lg bg-white">
        <h2 className="font-semibold mb-4">Añadir Miembro</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Nombre"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            disabled={adding}
            className="flex-1 px-3 py-2 border rounded-lg"
          />
          <input
            type="email"
            placeholder="Email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            disabled={adding}
            className="flex-1 px-3 py-2 border rounded-lg"
          />
          <Button onClick={handleAdd} disabled={adding}>
            Añadir
          </Button>
        </div>
      </div>

      {/* Team List */}
      <div className="border rounded-lg overflow-x-auto bg-white">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-4 text-left">Nombre</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {activeTeam.map(member => (
              <tr key={member.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium">{member.name}</td>
                <td className="p-4 text-gray-600">{member.email}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => handleDelete(member.id)}
                    className="text-gray-400 hover:text-red-500 transition inline-block"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {activeTeam.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>Sin miembros del equipo aún</p>
          </div>
        )}
      </div>
    </div>
  );
}
