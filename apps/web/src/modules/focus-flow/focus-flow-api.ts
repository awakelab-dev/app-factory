import { ApiError, getToken } from '../../lib/api';

/**
 * `DELETE /focus-flow/tasks/:id` responde 204 sin body — `apiFetch` de
 * `lib/api.ts` siempre hace `schema.parse(await res.json())`, que revienta
 * contra un body vacío. Este módulo no puede tocar `lib/api.ts` (fuera de su
 * carpeta), así que define su propio helper mínimo (mismo patrón que
 * `gestor-proyectos-api.ts`).
 */
export async function apiDelete(path: string): Promise<void> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { method: 'DELETE', headers });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
}
