import { apiFetch } from '../../lib/api';
import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskHistoryList,
  ScheduleGrid,
  TeamMember,
  TeamListResponse,
  KPIs
} from './panel-prioridades.types';
import {
  tasksListResponseSchema,
  taskSchema,
  scheduleGridSchema,
  teamMemberSchema,
  teamListResponseSchema,
  kpIsSchema,
  taskHistoryListSchema
} from './panel-prioridades.types';

/**
 * API client para Panel de Prioridades.
 * Cada función es un wrapper sobre apiFetch con validación Zod del tipo.
 */

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function listTasks(
  filters?: {
    quadrant?: number;
    status?: 'open' | 'done' | 'discarded';
    origin?: string;
  }
): Promise<{ tasks: TaskWithOverdue[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.quadrant) params.append('quadrant', String(filters.quadrant));
  if (filters?.status) params.append('status', filters.status);
  if (filters?.origin) params.append('origin', filters.origin);

  const query = params.toString();
  const url = `/api/panel-prioridades/tasks${query ? `?${query}` : ''}`;

  return apiFetch(url, tasksListResponseSchema);
}

export async function createTask(body: CreateTaskRequest): Promise<Task> {
  return apiFetch('/api/panel-prioridades/tasks', taskSchema, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function updateTask(id: string, body: UpdateTaskRequest): Promise<Task> {
  return apiFetch(`/api/panel-prioridades/tasks/${id}`, taskSchema, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export async function deleteTask(id: string): Promise<void> {
  await apiFetch(`/api/panel-prioridades/tasks/${id}`, null, {
    method: 'DELETE'
  });
}

export async function getTaskHistory(id: string): Promise<TaskHistoryList> {
  return apiFetch(`/api/panel-prioridades/tasks/${id}/history`, taskHistoryListSchema);
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export async function getScheduleGrid(): Promise<ScheduleGrid> {
  return apiFetch('/api/panel-prioridades/schedule', scheduleGridSchema);
}

export async function toggleScheduleBlock(
  taskId: string,
  day: number,
  hour: number,
  taskIdValue?: string | null
): Promise<void> {
  const body = taskIdValue === undefined ? {} : { taskId: taskIdValue };
  await apiFetch(`/api/panel-prioridades/schedule/${taskId}/${day}/${hour}`, null, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export async function getTeam(): Promise<TeamListResponse> {
  return apiFetch('/api/panel-prioridades/team', teamListResponseSchema);
}

export async function addTeamMember(body: {
  name: string;
  email: string;
}): Promise<TeamMember> {
  return apiFetch('/api/panel-prioridades/team', teamMemberSchema, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function updateTeamMember(
  id: string,
  body: Partial<{
    name: string;
    email: string;
    active: boolean;
  }>
): Promise<TeamMember> {
  return apiFetch(`/api/panel-prioridades/team/${id}`, teamMemberSchema, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export async function deleteTeamMember(id: string): Promise<void> {
  await apiFetch(`/api/panel-prioridades/team/${id}`, null, {
    method: 'DELETE'
  });
}

// ---------------------------------------------------------------------------
// Delegations
// ---------------------------------------------------------------------------

export async function setDelegation(
  taskId: string,
  body: Partial<{
    delegatedToName: string | null;
    followUpDate: Date | null;
  }>
): Promise<void> {
  await apiFetch(`/api/panel-prioridades/tasks/${taskId}/delegate`, null, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export async function getKPIs(): Promise<KPIs> {
  return apiFetch('/api/panel-prioridades/kpis', kpIsSchema);
}
