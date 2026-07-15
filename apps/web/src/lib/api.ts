import type { ZodType } from 'zod';

/**
 * Cliente HTTP mínimo del shell: adjunta el JWT de plataforma y valida SIEMPRE
 * la respuesta contra el schema Zod compartido de @awk/types.
 */

const TOKEN_KEY = 'awk.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token === null) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json');

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
  return schema.parse(await res.json());
}

/**
 * Variante para endpoints que no responden JSON (p. ej. el export CSV de
 * orientador-ia, `Content-Type: text/csv`) — mismo adjunto de JWT, sin
 * validar con Zod. El caller decide qué hacer con el Blob (aquí: disparar
 * una descarga de archivo desde el navegador).
 */
export async function apiFetchBlob(path: string, init?: RequestInit): Promise<Blob> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
  return res.blob();
}
