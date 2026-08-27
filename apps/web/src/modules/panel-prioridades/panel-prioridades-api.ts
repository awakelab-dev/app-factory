import { getToken, ApiError } from '../../lib/api';
import type {
  PanelTask,
  CreatePanelTaskRequest,
  UpdatePanelTaskRequest,
  PanelTeamMember,
  CreateTeamMemberRequest,
  UpdateTeamMemberRequest,
  PanelDelegation,
  ScheduleWeek,
  PanelKpisResponse
} from './panel-prioridades.types';

const BASE_URL = '/api/panel-prioridades';

/**
 * Helper mínimo para fetch con autenticación.
 * Patrón: mismo que focus-flow-api.ts por guardarraíl de generación.
 */
async function apiCall<T>(
  path: string,
  init?: RequestInit & { method?: string }
): Promise<T> {
  const headers = new Headers(init?.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);

  if (res.status === 204) return undefined as any; // No content
  return res.json();
}

async function apiDelete(path: string): Promise<void> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { method: 'DELETE', headers });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
}

// ============================================================================
// Tareas
// ============================================================================

export async function listPanelTasks(filters?: {
  quadrant?: number;
  status?: string;
  origin?: string;
}): Promise<PanelTask[]> {
  const params = new URLSearchParams();
  if (filters?.quadrant !== undefined) params.append('quadrant', String(filters.quadrant));
  if (filters?.status) params.append('status', filters.status);
  if (filters?.origin) params.append('origin', filters.origin);

  const query = params.toString();
  const url = query ? `${BASE_URL}/tasks?${query}` : `${BASE_URL}/tasks`;
  return apiCall(url);
}

export async function getPanelTask(taskId: string): Promise<PanelTask> {
  return apiCall(`${BASE_URL}/tasks/${taskId}`);
}

export async function createPanelTask(request: CreatePanelTaskRequest): Promise<PanelTask> {
  return apiCall(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
}

export async function updatePanelTask(
  taskId: string,
  request: UpdatePanelTaskRequest
): Promise<PanelTask> {
  return apiCall(`${BASE_URL}/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
}

export async function deletePanelTask(taskId: string, status?: 'done' | 'discarded'): Promise<void> {
  const url = status ? `${BASE_URL}/tasks/${taskId}?status=${status}` : `${BASE_URL}/tasks/${taskId}`;
  return apiDelete(url);
}

export async function getPanelTaskHistory(taskId: string): Promise<any[]> {
  return apiCall(`${BASE_URL}/tasks/${taskId}/history`);
}

// ============================================================================
// Agenda
// ============================================================================

export async function getWeekSchedule(): Promise<ScheduleWeek> {
  return apiCall(`${BASE_URL}/schedule`);
}

export async function reserveBlock(
  taskId: string,
  dayOfWeek: number,
  hour: number
): Promise<void> {
  return apiCall(`${BASE_URL}/schedule/${taskId}/${dayOfWeek}/${hour}`, {
    method: 'POST'
  });
}

export async function releaseBlock(dayOfWeek: number, hour: number): Promise<void> {
  return apiDelete(`${BASE_URL}/schedule/${dayOfWeek}/${hour}`);
}

// ============================================================================
// Equipo
// ============================================================================

export async function listTeamMembers(): Promise<PanelTeamMember[]> {
  return apiCall(`${BASE_URL}/team`);
}

export async function getTeamMember(memberId: string): Promise<PanelTeamMember> {
  return apiCall(`${BASE_URL}/team/${memberId}`);
}

export async function addTeamMember(request: CreateTeamMemberRequest): Promise<PanelTeamMember> {
  return apiCall(`${BASE_URL}/team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
}

export async function updateTeamMember(
  memberId: string,
  request: UpdateTeamMemberRequest
): Promise<PanelTeamMember> {
  return apiCall(`${BASE_URL}/team/${memberId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
}

export async function removeTeamMember(memberId: string): Promise<void> {
  return apiDelete(`${BASE_URL}/team/${memberId}`);
}

// ============================================================================
// Delegaciones
// ============================================================================

export async function listDelegations(): Promise<PanelDelegation[]> {
  return apiCall(`${BASE_URL}/delegations`);
}

export async function getDelegation(delegationId: string): Promise<PanelDelegation> {
  return apiCall(`${BASE_URL}/delegations/${delegationId}`);
}

export async function setTaskDelegation(
  taskId: string,
  delegatedToName: string | null,
  followUpDate?: string | null
): Promise<PanelDelegation> {
  return apiCall(`${BASE_URL}/tasks/${taskId}/delegate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delegatedToName, followUpDate })
  });
}

// ============================================================================
// KPIs
// ============================================================================

export async function getKpis(): Promise<PanelKpisResponse> {
  return apiCall(`${BASE_URL}/kpis`);
}
