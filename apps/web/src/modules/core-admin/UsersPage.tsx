import { useEffect, useState } from 'react';
import { Button } from '@awk/ui';
import {
  coreRolesResponseSchema,
  coreUserSchema,
  coreUsersResponseSchema,
  type CoreRole,
  type CoreUser
} from '@awk/types';
import { useAuth } from '../../auth/auth-context';
import { apiFetch } from '../../lib/api';

type UsersState =
  | { status: 'loading' }
  | { status: 'ok'; users: CoreUser[]; roles: CoreRole[] }
  | { status: 'error'; detail: string };

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
}

/**
 * Usuarios y ROLES del core. Hasta 2026-08-17 esta pantalla solo LEÍA: asignar
 * un rol era un `INSERT` a mano por SQL — y con él, la única forma de hacer
 * visible un módulo generado que declara roles nuevos. Pasó con
 * `incidencias-aula` y con `reserva-salas` (D-049). Desde el incremento D
 * (bloque 2) los roles se siembran solos al arrancar la API y se asignan aquí.
 *
 * El aviso de re-login no es decorativo: los roles viajan dentro del JWT
 * (`AuthService` los mete en el payload al hacer login), así que un cambio no
 * afecta a las sesiones ya abiertas.
 */
export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [state, setState] = useState<UsersState>({ status: 'loading' });
  const [editing, setEditing] = useState<{ userId: string; roles: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/core/users', coreUsersResponseSchema),
      apiFetch('/api/core/roles', coreRolesResponseSchema)
    ])
      .then(([users, roles]) => setState({ status: 'ok', users, roles }))
      .catch((err: unknown) =>
        setState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, []);

  const toggleRole = (role: string) =>
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            roles: prev.roles.includes(role)
              ? prev.roles.filter((name) => name !== role)
              : [...prev.roles, role]
          }
        : prev
    );

  async function save(): Promise<void> {
    if (!editing || state.status !== 'ok') return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await apiFetch(`/api/core/users/${editing.userId}/roles`, coreUserSchema, {
        method: 'PUT',
        body: JSON.stringify({ roles: editing.roles })
      });
      setState({
        ...state,
        users: state.users.map((user) => (user.id === updated.id ? updated : user))
      });
      setNotice(
        updated.id === currentUser?.id
          ? `Roles de ${updated.displayName} actualizados. Son TUS roles: vuelve a iniciar sesión para que apliquen (viajan en el token).`
          : `Roles de ${updated.displayName} actualizados. Tendrá que volver a iniciar sesión para que apliquen (viajan en el token).`
      );
      setEditing(null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold text-white">
        Usuarios <span className="text-awk-cyan-400">·</span> core
      </h1>
      <p className="mt-2 text-awk-blue-300">
        Usuarios y roles de la plataforma (schema <code className="text-awk-cyan-100">core</code>). Los
        roles de cada módulo se crean solos al arrancar la API; aquí se asignan.
      </p>

      {notice && (
        <p
          className="mt-6 rounded-lg border border-awk-cyan-500 bg-awk-navy-800 px-4 py-3 text-sm text-awk-cyan-200"
          data-testid="roles-notice"
          role="status"
        >
          {notice}
        </p>
      )}

      <section className="mt-8 overflow-hidden rounded-xl border border-awk-blue-700">
        {state.status === 'loading' && (
          <p className="bg-awk-navy-800 p-6 text-awk-blue-300">Cargando usuarios…</p>
        )}

        {state.status === 'error' && (
          <p className="bg-awk-navy-800 p-6 text-red-400" data-testid="users-error">
            No se pudo cargar la lista ({state.detail}).
          </p>
        )}

        {state.status === 'ok' && (
          <table className="w-full bg-awk-navy-800 text-left text-sm" data-testid="users-table">
            <thead>
              <tr className="border-b border-awk-blue-700 text-awk-blue-300">
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Roles</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium sr-only">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {state.users.map((user) => {
                const isEditing = editing?.userId === user.id;
                return (
                  <tr key={user.id} className="border-b border-awk-blue-800 align-top last:border-0">
                    <td className="px-4 py-3 text-awk-blue-50">{user.displayName}</td>
                    <td className="px-4 py-3 text-awk-blue-300">{user.email}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-1" data-testid={`roles-editor-${user.id}`}>
                          {state.roles.map((role) => (
                            <label
                              key={role.name}
                              className="flex items-start gap-2 text-xs text-awk-blue-100"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 accent-awk-cyan-400"
                                checked={editing.roles.includes(role.name)}
                                onChange={() => toggleRole(role.name)}
                              />
                              <span>
                                <span className="text-awk-cyan-300">{role.name}</span>
                                <span className="block text-awk-blue-400">{role.description}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <span
                            key={role}
                            className="mr-1 rounded-full bg-awk-blue-800 px-2 py-0.5 text-xs text-awk-cyan-300"
                          >
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-awk-blue-400">sin roles</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={user.isActive ? 'text-awk-cyan-400' : 'text-awk-blue-400'}>
                        {user.isActive ? 'activo' : 'inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => void save()}
                            disabled={saving || sameSet(editing.roles, user.roles)}
                          >
                            {saving ? 'Guardando…' : 'Guardar'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(null)}
                            disabled={saving}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSaveError(null);
                            setEditing({ userId: user.id, roles: [...user.roles] });
                          }}
                        >
                          Editar roles
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {saveError && (
        <p className="mt-4 text-sm text-red-400" data-testid="roles-save-error">
          No se pudieron guardar los roles ({saveError}).
        </p>
      )}
    </div>
  );
}
