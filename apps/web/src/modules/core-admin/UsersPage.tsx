import { useEffect, useState } from 'react';
import { coreUsersResponseSchema, type CoreUser } from '@awk/types';
import { apiFetch } from '../../lib/api';

type UsersState =
  | { status: 'loading' }
  | { status: 'ok'; users: CoreUser[] }
  | { status: 'error'; detail: string };

/** Primer consumidor real del RBAC: GET /api/core/users exige rol admin. */
export function UsersPage() {
  const [state, setState] = useState<UsersState>({ status: 'loading' });

  useEffect(() => {
    apiFetch('/api/core/users', coreUsersResponseSchema)
      .then((users) => setState({ status: 'ok', users }))
      .catch((err: unknown) =>
        setState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold text-white">
        Usuarios <span className="text-awk-cyan-400">·</span> core
      </h1>
      <p className="mt-2 text-awk-blue-300">
        Usuarios de la plataforma (schema <code className="text-awk-cyan-100">core</code>).
      </p>

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
              </tr>
            </thead>
            <tbody>
              {state.users.map((user) => (
                <tr key={user.id} className="border-b border-awk-blue-800 last:border-0">
                  <td className="px-4 py-3 text-awk-blue-50">{user.displayName}</td>
                  <td className="px-4 py-3 text-awk-blue-300">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className="mr-1 rounded-full bg-awk-blue-800 px-2 py-0.5 text-xs text-awk-cyan-300"
                      >
                        {role}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={user.isActive ? 'text-awk-cyan-400' : 'text-awk-blue-400'}>
                      {user.isActive ? 'activo' : 'inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
