'use client';

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@awk/ui';
import { listTeamMembers, addTeamMember, removeTeamMember } from './panel-prioridades-api';
import type { PanelTeamMember } from './panel-prioridades.types';

/**
 * TeamPage: gestión del equipo local para delegaciones.
 * CRUD: crear, editar, activar/desactivar miembros.
 */
export function TeamPage() {
  const [members, setMembers] = useState<PanelTeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    listTeamMembers()
      .then(setMembers)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      alert('Nombre y email son obligatorios');
      return;
    }

    try {
      await addTeamMember({ name, email });
      setName('');
      setEmail('');
      setShowForm(false);
      // Reload
      const updated = await listTeamMembers();
      setMembers(updated);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (confirm('¿Desactivar este miembro?')) {
      try {
        await removeTeamMember(memberId);
        // Reload
        const updated = await listTeamMembers();
        setMembers(updated);
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mi Equipo</h1>
          <p className="text-gray-600">Gestiona personas para delegar tareas</p>
        </div>
        <Link to="/panel-prioridades">
          <Button variant="outline">← Volver a Matriz</Button>
        </Link>
      </div>

      {/* Formulario de añadir miembro */}
      <div className="rounded-lg border border-gray-200 p-4">
        {showForm ? (
          <form onSubmit={handleAdd} className="space-y-3">
            <input
              type="text"
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={addMember.isPending}>
                Añadir
              </Button>
              <Button type="button" onClick={() => setShowForm(false)} variant="outline">
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setShowForm(true)} className="w-full">
            + Añadir miembro al equipo
          </Button>
        )}
      </div>

      {/* Lista de miembros */}
      <div className="rounded-lg border border-gray-200 p-4">
        {isLoading ? (
          <p className="text-gray-600">Cargando equipo...</p>
        ) : members.length === 0 ? (
          <p className="text-gray-600">Sin miembros aún. Añade tu primer compañero.</p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between border-b p-2">
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-gray-600">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!member.active && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      Inactivo
                    </span>
                  )}
                  {member.active && (
                    <Button
                      onClick={() => handleRemove(member.id)}
                      disabled={removeMember.isPending}
                      variant="outline"
                    >
                      Desactivar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
