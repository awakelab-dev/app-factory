import { z } from 'zod';
import { apiFetch } from '../../lib/api';
import type {
  CreateTicketRequest,
  CreateTicketMessageRequest,
  UpdateTicketRequest,
  Ticket,
  TicketDetail,
  Department,
  HelpTopic,
  Dashboard,
  KBArticle,
  LoginResponse,
  VerifySessionResponse,
  ExternalUser,
  ExternalUsersList
} from './mesa-ayuda.types';
import {
  ticketDetailSchema,
  ticketSchema,
  departmentSchema,
  helpTopicSchema,
  dashboardSchema,
  kbArticleSchema,
  loginResponseSchema,
  verifySessionSchema,
  externalUserSchema,
  externalUsersListSchema
} from './mesa-ayuda.types';

const BASE_PATH = '/api/mesa-ayuda';

/**
 * Cliente API para Mesa de Ayuda (lado web).
 * Envuelve las llamadas al backend con la lógica de autenticación compartida.
 */

// ---------------------------------------------------------------------------
// Endpoints públicos: Auth externa (change-2)
// ---------------------------------------------------------------------------

/**
 * Login de usuario externo (email + contraseña).
 */
export async function loginExternal(email: string, password: string): Promise<LoginResponse> {
  return apiFetch(`${BASE_PATH}/auth/login`, loginResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

/**
 * Cambiar contraseña (requiere token provisional).
 */
export async function changePassword(provisionalToken: string, newPassword: string): Promise<LoginResponse> {
  return apiFetch(`${BASE_PATH}/auth/change-password`, loginResponseSchema, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provisionalToken}`
    },
    body: JSON.stringify({ newPassword })
  });
}

/**
 * Verificar si un sessionToken es válido.
 */
export async function verifySession(token: string): Promise<VerifySessionResponse> {
  return apiFetch(`${BASE_PATH}/auth/verify-session?token=${token}`, verifySessionSchema);
}

// ---------------------------------------------------------------------------
// Endpoints públicos: Tickets
// ---------------------------------------------------------------------------

/**
 * Crear un ticket (sin login requerido).
 * Devuelve un sessionToken que el solicitante puede guardar para seguimiento.
 */
export async function createTicket(data: CreateTicketRequest): Promise<TicketDetail> {
  return apiFetch(`${BASE_PATH}/tickets`, ticketDetailSchema, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * Obtener ticket por ID con sessionToken (sin login).
 * El solicitante solo ve mensajes públicos.
 */
export async function getTicketPublic(id: string, sessionToken: string): Promise<TicketDetail> {
  return apiFetch(`${BASE_PATH}/tickets/${id}?sessionToken=${sessionToken}`, ticketDetailSchema);
}

/**
 * Listar temas de soporte (para dropdown en formulario de creación).
 */
export async function listHelpTopics(departmentId?: string): Promise<HelpTopic[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : '';
  return apiFetch(`${BASE_PATH}/help-topics${params}`, z.array(helpTopicSchema));
}

/**
 * Listar artículos de KB (base de conocimiento pública).
 */
export async function listKBArticles(topicId?: string): Promise<KBArticle[]> {
  const params = topicId ? `?topicId=${topicId}` : '';
  return apiFetch(`${BASE_PATH}/kb${params}`, z.array(kbArticleSchema));
}

/**
 * Listar departamentos activos (para dropdown).
 */
export async function listDepartments(): Promise<Department[]> {
  return apiFetch(`${BASE_PATH}/departments`, z.array(departmentSchema));
}

// ---------------------------------------------------------------------------
// Endpoints privados (con auth de agente/admin)
// ---------------------------------------------------------------------------

/**
 * Obtener dashboard de métricas para agentes.
 */
export async function getDashboard(): Promise<Dashboard> {
  return apiFetch(`${BASE_PATH}/dashboard`, dashboardSchema);
}

/**
 * Listar tickets con filtros.
 */
export async function listTickets(filters?: {
  status?: string;
  departmentId?: string;
  priority?: string;
  assignedToMe?: boolean;
}): Promise<Ticket[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.departmentId) params.append('departmentId', filters.departmentId);
  if (filters?.priority) params.append('priority', filters.priority);
  if (filters?.assignedToMe) params.append('assignedToMe', 'true');

  const queryStr = params.toString();
  const url = queryStr ? `${BASE_PATH}/tickets-list?${queryStr}` : `${BASE_PATH}/tickets-list`;

  return apiFetch(url, z.array(ticketSchema));
}

/**
 * Actualizar ticket (estado, prioridad, asignación).
 */
export async function updateTicket(id: string, data: UpdateTicketRequest): Promise<Ticket> {
  return apiFetch(`${BASE_PATH}/tickets/${id}`, ticketSchema, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

/**
 * Añadir mensaje a un ticket.
 */
export async function addTicketMessage(
  id: string,
  data: CreateTicketMessageRequest
): Promise<Ticket> {
  return apiFetch(`${BASE_PATH}/tickets/${id}/messages`, ticketSchema, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// ---------------------------------------------------------------------------
// Endpoints admin: Gestión de usuarios externos (change-2)
// ---------------------------------------------------------------------------

/**
 * Listar usuarios externos con búsqueda y filtros.
 */
export async function listExternalUsers(filters?: {
  search?: string;
  status?: 'active' | 'inactive';
  sortBy?: 'createdAt' | 'email' | 'organization';
}): Promise<ExternalUsersList> {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.sortBy) params.append('sortBy', filters.sortBy);

  const queryStr = params.toString();
  const url = queryStr ? `${BASE_PATH}/admin/external-users?${queryStr}` : `${BASE_PATH}/admin/external-users`;

  return apiFetch(url, externalUsersListSchema);
}

/**
 * Crear nuevo usuario externo.
 */
export async function createExternalUser(data: {
  email: string;
  displayName: string;
  requesterOrganization?: string;
}): Promise<{
  id: string;
  email: string;
  displayName: string;
  temporaryPassword: string;
  requesterOrganization: string | null;
  createdAt: Date;
}> {
  const schema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string(),
    temporaryPassword: z.string(),
    requesterOrganization: z.string().nullable(),
    createdAt: z.coerce.date()
  });

  return apiFetch(`${BASE_PATH}/admin/external-users`, schema, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * Activar o desactivar usuario externo.
 */
export async function updateExternalUserActive(userId: string, isActive: boolean): Promise<ExternalUser> {
  return apiFetch(`${BASE_PATH}/admin/external-users/${userId}/active`, externalUserSchema, {
    method: 'PATCH',
    body: JSON.stringify({ isActive })
  });
}

/**
 * Resetear contraseña de usuario externo.
 */
export async function resetExternalUserPassword(userId: string): Promise<{
  id: string;
  email: string;
  temporaryPassword: string;
}> {
  const schema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    temporaryPassword: z.string()
  });

  return apiFetch(`${BASE_PATH}/admin/external-users/${userId}/password-reset`, schema, {
    method: 'PATCH'
  });
}

/**
 * Obtener historial de auditoría de usuario externo.
 */
export async function getExternalUserAudit(userId: string): Promise<{
  userId: string;
  email: string;
  auditEvents: Array<{
    id: string;
    action: string;
    createdAt: Date;
    details?: Record<string, unknown>;
  }>;
}> {
  const schema = z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
    auditEvents: z.array(z.object({
      id: z.string().uuid(),
      action: z.string(),
      createdAt: z.coerce.date(),
      details: z.object({}).optional()
    }))
  });

  return apiFetch(`${BASE_PATH}/admin/external-users/${userId}/audit`, schema);
}
