import { z } from 'zod';

/**
 * Contratos (Zod) de `mesa-ayuda` — Mesa de Ayuda Awakelab.
 *
 * Nota de gate técnico (VINCULANTE): la spec técnica original proponía
 * exportar estos enums/DTOs desde `@awk/types`, pero ese paquete es un punto
 * de integración compartido entre módulos generados en paralelo y este paso
 * de generación SOLO puede escribir dentro de las carpetas de su propio
 * módulo (docs/04, paso 4). Los esquemas quedan, por tanto, LOCALES a este
 * módulo (aquí y en su espejo `apps/web/.../mesa-ayuda.types.ts`).
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

export const createDepartmentRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
});
export type CreateDepartmentRequest = z.infer<typeof createDepartmentRequestSchema>;

export const updateDepartmentRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional()
});
export type UpdateDepartmentRequest = z.infer<typeof updateDepartmentRequestSchema>;

// ---------------------------------------------------------------------------
// SLA
// ---------------------------------------------------------------------------

export const slaSchema = z.object({
  id: z.string().uuid(),
  departmentId: z.string().uuid(),
  priority: ticketPriorityEnum,
  responseTimeMinutes: z.number().int().positive(),
  resolutionTimeMinutes: z.number().int().positive(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type SLA = z.infer<typeof slaSchema>;

export const createSLARequestSchema = z.object({
  departmentId: z.string().uuid(),
  priority: ticketPriorityEnum,
  responseTimeMinutes: z.number().int().positive(),
  resolutionTimeMinutes: z.number().int().positive()
});
export type CreateSLARequest = z.infer<typeof createSLARequestSchema>;

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

export const createHelpTopicRequestSchema = z.object({
  departmentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  displayOrder: z.number().int().nonnegative().default(0)
});
export type CreateHelpTopicRequest = z.infer<typeof createHelpTopicRequestSchema>;

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
  description: z.string(),
  assignedToAgentId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  slaVencimientoAt: z.coerce.date().nullable(),
  slaCongeladoAt: z.coerce.date().nullable()
});
export type Ticket = z.infer<typeof ticketSchema>;

/**
 * Alta de una petición. El solicitante va autenticado, así que su nombre y su
 * correo se toman del JWT: aceptarlos en el cuerpo permitiría suplantar a otra
 * persona.
 */
export const createTicketRequestSchema = z.object({
  departmentId: z.string().uuid(),
  topicId: z.string().uuid(),
  subject: z.string().min(1).max(300),
  description: z.string().min(1),
  priority: ticketPriorityEnum.optional().default('media')
});
export type CreateTicketRequest = z.infer<typeof createTicketRequestSchema>;

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

export const updateTicketRequestSchema = z.object({
  status: ticketStatusEnum.optional(),
  priority: ticketPriorityEnum.optional(),
  assignedToAgentId: z.string().uuid().nullable().optional()
});
export type UpdateTicketRequest = z.infer<typeof updateTicketRequestSchema>;

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

export const createKBArticleRequestSchema = z.object({
  topicId: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  isPublished: z.boolean().default(true)
});
export type CreateKBArticleRequest = z.infer<typeof createKBArticleRequestSchema>;

// ---------------------------------------------------------------------------
// Canned Responses
// ---------------------------------------------------------------------------

export const cannedResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  content: z.string(),
  category: z.string(),
  isActive: z.boolean(),
  usageCount: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type CannedResponse = z.infer<typeof cannedResponseSchema>;

export const createCannedResponseRequestSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1),
  category: z.string().min(1).max(50)
});
export type CreateCannedResponseRequest = z.infer<typeof createCannedResponseRequestSchema>;
