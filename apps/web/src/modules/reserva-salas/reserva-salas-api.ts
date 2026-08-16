import { ApiError, apiFetch, getToken } from '../../lib/api';
import {
  createReservaRequestSchema,
  createSalaRequestSchema,
  reservaSchema,
  reservasResponseSchema,
  salaDetailSchema,
  salaSchema,
  salasResponseSchema,
  updateSalaRequestSchema,
  type CreateReservaRequest,
  type CreateSalaRequest,
  type Reserva,
  type Sala,
  type SalaDetail,
  type UpdateSalaRequest
} from './reserva-salas.types';

const BASE = '/api/reserva-salas';

/**
 * `DELETE /reservas/:id` responde 204 sin body — `apiFetch` de `lib/api.ts`
 * siempre hace `schema.parse(await res.json())`, que revienta contra un body
 * vacío. Este módulo no puede tocar `lib/api.ts` (fuera de su carpeta), así
 * que define su propio helper mínimo reutilizando el mismo adjunto de JWT —
 * mismo criterio que `gestor-proyectos-api.ts#apiDelete`.
 */
export async function apiDelete(path: string): Promise<void> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { method: 'DELETE', headers });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
}

export function fetchSalas(todas = false): Promise<Sala[]> {
  const query = todas ? '?todas=true' : '';
  return apiFetch(`${BASE}/salas${query}`, salasResponseSchema);
}

export function fetchSalaDetail(salaId: string, fecha: string): Promise<SalaDetail> {
  return apiFetch(`${BASE}/salas/${salaId}?fecha=${fecha}`, salaDetailSchema);
}

export function createSala(payload: CreateSalaRequest): Promise<Sala> {
  createSalaRequestSchema.parse(payload);
  return apiFetch(`${BASE}/salas`, salaSchema, { method: 'POST', body: JSON.stringify(payload) });
}

export function updateSala(salaId: string, payload: UpdateSalaRequest): Promise<Sala> {
  updateSalaRequestSchema.parse(payload);
  return apiFetch(`${BASE}/salas/${salaId}`, salaSchema, { method: 'PUT', body: JSON.stringify(payload) });
}

export function toggleActivaSala(salaId: string): Promise<Sala> {
  return apiFetch(`${BASE}/salas/${salaId}/toggle-activa`, salaSchema, { method: 'PATCH' });
}

export function fetchReservas(desde?: string): Promise<Reserva[]> {
  const query = desde ? `?desde=${desde}` : '';
  return apiFetch(`${BASE}/reservas${query}`, reservasResponseSchema);
}

export function createReserva(payload: CreateReservaRequest): Promise<Reserva> {
  createReservaRequestSchema.parse(payload);
  return apiFetch(`${BASE}/reservas`, reservaSchema, { method: 'POST', body: JSON.stringify(payload) });
}

export function cancelReserva(reservaId: string): Promise<void> {
  return apiDelete(`${BASE}/reservas/${reservaId}`);
}
