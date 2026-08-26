import { z } from 'zod';

/**
 * Contratos (Zod) locales de `mesa-ayuda` en el side web.
 * Espejo de los esquemas de la API (`apps/api/src/modules/mesa-ayuda/mesa-ayuda.types.ts`).
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ticketStatusEnum = z.enum(['abierto', 'en_proceso', 'resuelto', 'cerrado', 'reabierto']);
export type TicketStatus = z.infer<typeof ticketStatusEnum>;

export const ticketPriorityEnum = z.enum(['baja', 'media', 'alta', 'urgente']);
export type TicketPriority = z.infer<typeof ticketPriorityEnum>;

// ---------------------------------------------------------------------------
// Departamentos
// ---------------------------------------------------------------------------

export const departmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type Department = z.infer<typeof departmentSchema>;

// ---------------------------------------------------------------------------
// Help Topics
// ---------------------------------------------------------------------------

export const helpTopicSchema = z.object({
  id: z.string().uuid(),
  departmentId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  displayOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type HelpTopic = z.infer<typeof helpTopicSchema>;

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export const ticketSchema = z.object({
  id: z.string().uuid(),
  ticket_number: z.number().int(),
  departmentId: z.string().uuid(),
  topicId: z.string().uuid(),
  status: ticketStatusEnum,
  priority: ticketPriorityEnum,
  subject: z.string(),
  requestorEmail: z.string().email(),
  requestorName: z.string(),
  sessionToken: z.string().uuid().nullable().optional(),
  requesterId: z.string().uuid().nullable().optional(),
  description: z.string(),
  assignedToAgentId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  slaVencimientoAt: z.coerce.date().nullable(),
  slaCongeladoAt: z.coerce.date().nullable()
});
export type Ticket = z.infer<typeof ticketSchema>;

export const createTicketRequestSchema = z.object({
  departmentId: z.string().uuid(),
  topicId: z.string().uuid(),
  subject: z.string().min(1).max(300),
  requestorEmail: z.string().email().max(255),
  requestorName: z.string().min(1).max(150),
  description: z.string().min(1),
  priority: ticketPriorityEnum.optional().default('media')
});
export type CreateTicketRequest = z.infer<typeof createTicketRequestSchema>;

export const updateTicketRequestSchema = z.object({
  status: ticketStatusEnum.optional(),
  priority: ticketPriorityEnum.optional(),
  departmentId: z.string().uuid().optional(),
  assignedToAgentId: z.string().uuid().nullable().optional()
});
export type UpdateTicketRequest = z.infer<typeof updateTicketRequestSchema>;

export const ticketDetailSchema = ticketSchema.extend({
  departmentName: z.string(),
  topicName: z.string(),
  messages: z.array(
    z.object({
      id: z.string().uuid(),
      senderEmail: z.string().email(),
      senderName: z.string(),
      content: z.string(),
      isPublic: z.boolean(),
      createdAt: z.coerce.date()
    })
  )
});
export type TicketDetail = z.infer<typeof ticketDetailSchema>;

// ---------------------------------------------------------------------------
// Ticket Messages
// ---------------------------------------------------------------------------

export const ticketMessageSchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  senderEmail: z.string().email(),
  senderName: z.string(),
  content: z.string(),
  isPublic: z.boolean(),
  createdAt: z.coerce.date()
});
export type TicketMessage = z.infer<typeof ticketMessageSchema>;

export const createTicketMessageRequestSchema = z.object({
  content: z.string().min(1),
  isPublic: z.boolean().default(true)
});
export type CreateTicketMessageRequest = z.infer<typeof createTicketMessageRequestSchema>;

// ---------------------------------------------------------------------------
// KB Articles
// ---------------------------------------------------------------------------

export const kbArticleSchema = z.object({
  id: z.string().uuid(),
  topicId: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  excerpt: z.string().nullable(),
  isPublished: z.boolean(),
  viewCount: z.number().int(),
  upvotes: z.number().int(),
  downvotes: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type KBArticle = z.infer<typeof kbArticleSchema>;

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const dashboardSchema = z.object({
  openTickets: z.number().int(),
  myAssignedTickets: z.number().int(),
  overdueSLAs: z.number().int(),
  allTickets: z.number().int()
});
export type Dashboard = z.infer<typeof dashboardSchema>;

// ---------------------------------------------------------------------------
// Auth externa (change-2)
// ---------------------------------------------------------------------------

export const loginResponseSchema = z.object({
  requiresPasswordChange: z.boolean(),
  sessionToken: z.string().optional(),
  redirectTo: z.string()
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const verifySessionSchema = z.object({
  valid: z.boolean(),
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  requesterOrganization: z.string().nullable().optional(),
  displayName: z.string().optional(),
  error: z.string().optional()
});
export type VerifySessionResponse = z.infer<typeof verifySessionSchema>;

// ---------------------------------------------------------------------------
// Usuarios externos (change-2)
// ---------------------------------------------------------------------------

export const externalUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  requesterOrganization: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  lastExternalLoginAt: z.coerce.date().nullable(),
  externalMesaAyudaUser: z.literal(true)
});
export type ExternalUser = z.infer<typeof externalUserSchema>;

export const externalUsersListSchema = z.object({
  users: z.array(externalUserSchema)
});
export type ExternalUsersList = z.infer<typeof externalUsersListSchema>;
