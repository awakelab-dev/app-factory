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
  SLA,
  Dashboard,
  KBArticle,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  CreateHelpTopicRequest,
  CreateSLARequest
} from './mesa-ayuda.types';
import {
  ticketDetailSchema,
  ticketSchema,
  departmentSchema,
  helpTopicSchema,
  slaSchema,
  dashboardSchema,
  kbArticleSchema
} from './mesa-ayuda.types';

const BASE_PATH = '/api/mesa-ayuda';

/**
 * Cliente API para Mesa de Ayuda (lado web).
 * Envuelve las llamadas al backend con la lógica de autenticación compartida.
 */

// ---------------------------------------------------------------------------
// Endpoints del solicitante (autenticado, como el resto del módulo)
// ---------------------------------------------------------------------------

/**
 * Crear una petición. El nombre y el correo del solicitante los pone el backend
 * a partir del usuario autenticado.
 */
export async function createTicket(data: CreateTicketRequest): Promise<TicketDetail> {
  return apiFetch(`${BASE_PATH}/tickets`, ticketDetailSchema, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * Obtener un ticket por su id. El backend decide qué se ve según el rol: el
 * solicitante, solo los suyos y sin notas internas.
 */
export async function getTicket(id: string): Promise<TicketDetail> {
  return apiFetch(`${BASE_PATH}/tickets/${id}`, ticketDetailSchema);
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
// Administración de catálogos (rol mesa_ayuda_admin)
// ---------------------------------------------------------------------------

/** Alta de departamento. */
export async function createDepartment(data: CreateDepartmentRequest): Promise<Department> {
  return apiFetch(`${BASE_PATH}/admin/departments`, departmentSchema, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/** Edición de departamento (nombre, descripción, alta/baja). */
export async function updateDepartment(
  id: string,
  data: UpdateDepartmentRequest
): Promise<Department> {
  return apiFetch(`${BASE_PATH}/admin/departments/${id}`, departmentSchema, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

/** Alta de tema de ayuda dentro de un departamento. */
export async function createHelpTopic(data: CreateHelpTopicRequest): Promise<HelpTopic> {
  return apiFetch(`${BASE_PATH}/admin/help-topics`, helpTopicSchema, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/** Los SLA configurados, para poder verlos antes de crear otro. */
export async function listSLAs(departmentId?: string): Promise<SLA[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : '';
  return apiFetch(`${BASE_PATH}/admin/slas${params}`, z.array(slaSchema));
}

/** Alta de SLA para un departamento y una prioridad. */
export async function createSLA(data: CreateSLARequest): Promise<SLA> {
  return apiFetch(`${BASE_PATH}/admin/slas`, slaSchema, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
