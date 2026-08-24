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
  KBArticle
} from './mesa-ayuda.types';
import {
  ticketDetailSchema,
  ticketSchema,
  departmentSchema,
  helpTopicSchema,
  dashboardSchema,
  kbArticleSchema
} from './mesa-ayuda.types';

const BASE_PATH = '/api/mesa-ayuda';

/**
 * Cliente API para Mesa de Ayuda (lado web).
 * Envuelve las llamadas al backend con la lógica de autenticación compartida.
 */

// ---------------------------------------------------------------------------
// Endpoints públicos (sin auth)
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
