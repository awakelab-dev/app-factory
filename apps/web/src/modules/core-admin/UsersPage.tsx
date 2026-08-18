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

interface NewUserDraft {
  email: string;
  displayName: string;
  roles: string[];
}

const EMPTY_DRAFT: NewUserDraft = { email: '', displayName: '', roles: [] };

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/**
 * Usuarios y ROLES del core. Hasta 2026-08-17 esta pantalla solo LEÍA: dar de
 * alta a alguien o asignarle un rol era SQL a mano — y con ello, la única forma
 * de que un gerente del piloto entrara a staging o de que un módulo generado
 * fuera visible (D-049). Desde el incremento D (bloque 2) los roles se siembran
 * solos al arrancar la API, y aquí se da de alta, se asignan roles y se corta el
 * acceso, todo auditado.
 *
 * Dos avisos que la UI da explícitamente porque el sistema no puede evitarlos:
 *  - **Re-login**: los roles viajan dentro del JWT, así que un cambio no afecta
 *    a una sesión ya abierta.
 *  - **Dos identidades**: este usuario es el de la PLATAFORMA. El acceso al
 *    conector de Cowork es un actor de la Fábrica (otra base de datos), que se
 *    crea con el CLI — tener uno no da el otro.
 */
export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [state, setState] = useState<UsersState>({ status: 'loading' });
  const [editing, setEditing] = useState<{ userId: string; roles: string[] } | null>(null);
  const [draft, setDraft] = useState<NewUserDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  function upsertUser(updated: CoreUser): void {
    setState((prev) =>
      prev.status === 'ok'
        ? {
            ...prev,
            users: prev.users.some((user) => user.id === updated.id)
              ? prev.users.map((user) => (user.id === updated.id ? updated : user))
              : [...prev.users, updated]
          }
        : prev
    );
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const saveRoles = () =>
    run(async () => {
      if (!editing) return;
      const updated = await apiFetch(`/api/core/users/${editing.userId}/roles`, coreUserSchema, {
        method: 'PUT',
        body: JSON.stringify({ roles: editing.roles })
      });
      upsertUser(updated);
      setNotice(
        updated.id === currentUser?.id
          ? `Roles de ${updated.displayName} actualizados. Son TUS roles: vuelve a iniciar sesión para que apliquen (viajan en el token).`
          : `Roles de ${updated.displayName} actualizados. Tendrá que volver a iniciar sesión para que apliquen (viajan en el token).`
      );
      setEditing(null);
    });

  const createUser = () =>
    run(async () => {
      if (!draft) return;
      const created = await apiFetch('/api/core/users', coreUserSchema, {
        method: 'POST',
        body: JSON.stringify(draft)
      });
      upsertUser(created);
      setNotice(
        `Usuario ${created.email} creado. Ya puede entrar a la plataforma. Recuerda: para usar el conector de Cowork necesita además un actor de la Fábrica (CLI create-actor + set-password).`
      );
      setDraft(null);
    });

  const setActive = (user: CoreUser, isActive: boolean) =>
    run(async () => {
      const updated = await apiFetch(`/api/core/users/${user.id}/active`, coreUserSchema, {
        method: 'PATCH',
        body: JSON.stringify({ isActive })
      });
      upsertUser(updated);
      setNotice(
        isActive
          ? `Acceso devuelto a ${updated.displayName}.`
          : `Acceso cortado a ${updated.displayName}: no podrá volver a entrar (su sesión abierta caduca sola).`
      );
    });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-white">
          Usuarios <span className="text-awk-cyan-400">·</span> core
        </h1>
        {state.status === 'ok' && !draft && (
          <Button size="sm" onClick={() => { setActionError(null); setDraft(EMPTY_DRAFT); }}>
            Nuevo usuario
          </Button>
        )}
      </div>
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

      {state.status === 'ok' && draft && (
        <section
          className="mt-6 rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-5"
          data-testid="new-user-form"
        >
          <h2 className="text-lg font-semibold text-white">Nuevo usuario de plataforma</h2>
          <p className="mt-1 text-xs text-awk-blue-400">
            Da acceso a la plataforma (login por email). El acceso al conector de Cowork es otra cosa:
            se crea con el CLI de la Fábrica.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-awk-blue-100">
              Email
              <input
                type="email"
                value={draft.email}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                className="mt-1 w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50"
                placeholder="nombre.apellido@awakelab.dev"
              />
            </label>
            <label className="text-sm text-awk-blue-100">
              Nombre visible
              <input
                type="text"
                value={draft.displayName}
                onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
                className="mt-1 w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50"
                placeholder="Nombre Apellido"
              />
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="text-xs uppercase tracking-wide text-awk-blue-400">Roles iniciales</legend>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {state.roles.map((role) => (
                <label key={role.name} className="flex items-center gap-2 text-xs text-awk-blue-100">
                  <input
                    type="checkbox"
                    className="accent-awk-cyan-400"
                    checked={draft.roles.includes(role.name)}
                    onChange={() => setDraft({ ...draft, roles: toggle(draft.roles, role.name) })}
                  />
                  <span className="text-awk-cyan-300">{role.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              onClick={() => void createUser()}
              disabled={busy || !draft.email.includes('@') || draft.displayName.trim().length === 0}
            >
              {busy ? 'Creando…' : 'Crear usuario'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </section>
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
                                onChange={() => setEditing({ ...editing, roles: toggle(editing.roles, role.name) })}
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
                            onClick={() => void saveRoles()}
                            disabled={busy || sameSet(editing.roles, user.roles)}
                          >
                            {busy ? 'Guardando…' : 'Guardar'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(null)}
                            disabled={busy}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setActionError(null);
                              setEditing({ userId: user.id, roles: [...user.roles] });
                            }}
                          >
                            Editar roles
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy || user.id === currentUser?.id}
                            title={
                              user.id === currentUser?.id
                                ? 'No puedes cortarte el acceso a ti mismo'
                                : undefined
                            }
                            onClick={() => void setActive(user, !user.isActive)}
                          >
                            {user.isActive ? 'Dar de baja' : 'Reactivar'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {actionError && (
        <p className="mt-4 text-sm text-red-400" data-testid="roles-save-error">
          No se pudo completar la operación ({actionError}).
        </p>
      )}
    </div>
  );
}
