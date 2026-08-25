import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import type {
  CreateTicketRequest,
  CreateTicketMessageRequest,
  UpdateTicketRequest,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  CreateHelpTopicRequest,
  CreateSLARequest,
  CreateKBArticleRequest,
  CreateCannedResponseRequest,
  Ticket,
  TicketDetail,
  Department,
  HelpTopic,
  SLA,
  KBArticle,
  CannedResponse
} from './mesa-ayuda.types';

/**
 * Mesa de Ayuda: lógica de negocio de gestión de tickets de soporte.
 * - Crear/gestionar tickets (público por solicitante, privado por agentes/admin)
 * - Gestionar SLAs, departamentos, temas
 * - KB y respuestas preformuladas
 */
@Injectable()
export class MesaAyudaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  // ---------------------------------------------------------------------------
  // TICKETS
  // ---------------------------------------------------------------------------

  /**
   * Crear un ticket. El solicitante va autenticado: su nombre y su correo salen
   * del JWT, nunca de datos que él teclee.
   */
  async createTicket(user: AuthUser, body: CreateTicketRequest): Promise<TicketDetail> {
    // Validar que el departamento existe
    const department = await this.prisma.mesaAyudaDepartment.findUnique({
      where: { id: body.departmentId }
    });
    if (!department) {
      throw new BadRequestException('Departamento no encontrado');
    }

    // Validar que el topic existe y pertenece al departamento
    const topic = await this.prisma.mesaAyudaHelpTopic.findUnique({
      where: { id: body.topicId }
    });
    if (!topic || topic.departmentId !== body.departmentId) {
      throw new BadRequestException('Tema no encontrado en este departamento');
    }

    // Obtener SLA para calcular vencimiento
    const sla = await this.prisma.mesaAyudaSLA.findUnique({
      where: {
        departmentId_priority: {
          departmentId: body.departmentId,
          priority: body.priority
        }
      }
    });

    // La columna `sessionToken` sigue existiendo en el esquema y es NOT NULL /
    // UNIQUE, así que se rellena con un UUID interno. Ya no es una credencial:
    // no se acepta por la API ni se devuelve al cliente. La retirada de la
    // columna va en la migración del cambio de acceso.
    const sessionToken = crypto.randomUUID();
    const now = new Date();
    const slaVencimientoAt = sla
      ? new Date(now.getTime() + sla.responseTimeMinutes * 60 * 1000)
      : null;

    const ticket = await this.prisma.mesaAyudaTicket.create({
      data: {
        departmentId: body.departmentId,
        topicId: body.topicId,
        subject: body.subject,
        requestorEmail: user.email,
        requestorName: user.displayName,
        sessionToken,
        description: body.description,
        priority: body.priority,
        status: 'abierto',
        slaVencimientoAt,
        messages: {
          create: {
            senderEmail: user.email,
            senderName: user.displayName,
            content: body.description,
            isPublic: true
          }
        }
      },
      include: {
        department: true,
        topic: true,
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    await this.audit.log({
      action: 'mesa_ayuda.ticket_created',
      entity: 'ticket',
      entityId: ticket.id,
      metadata: {
        userId: user.id,
        email: user.email,
        subject: body.subject
      }
    });

    return this.mapTicketToDetail(ticket);
  }

  /**
   * Obtener un ticket. Siempre con usuario autenticado: el solicitante solo
   * accede a los suyos; agentes y administradores, a cualquiera.
   */
  async getTicket(id: string, user: AuthUser): Promise<TicketDetail> {
    const ticket = await this.prisma.mesaAyudaTicket.findUnique({
      where: { id },
      include: {
        department: true,
        topic: true,
        messages: {
          where: { isPublic: true }, // Solicitante solo ve mensajes públicos
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    // El solicitante solo puede abrir sus propios tickets. Antes bastaba con
    // omitir el token para leer cualquiera: la comprobación era condicional.
    const esPersonalDeSoporte =
      user.roles.includes('mesa_ayuda_agente') || user.roles.includes('mesa_ayuda_admin');
    if (!esPersonalDeSoporte && ticket.requestorEmail !== user.email) {
      throw new ForbiddenException('No tienes acceso a esta petición');
    }

    return this.mapTicketToDetail(ticket);
  }

  /**
   * Listar tickets (filtrable para agentes/admin, solo propios para solicitantes).
   */
  async listTickets(
    user: AuthUser,
    filters?: {
      status?: string;
      departmentId?: string;
      priority?: string;
      assignedToMe?: boolean;
    }
  ): Promise<Ticket[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }
    if (filters?.priority) {
      where.priority = filters.priority;
    }

    // Agentes/admin pueden ver todos; se filtra por departamento si aplica
    if (filters?.assignedToMe) {
      where.assignedToAgentId = user.id;
    }

    const tickets = await this.prisma.mesaAyudaTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return tickets;
  }

  /**
   * Actualizar ticket (solo agentes/admin).
   */
  async updateTicket(
    user: AuthUser,
    ticketId: string,
    body: UpdateTicketRequest
  ): Promise<Ticket> {
    const ticket = await this.prisma.mesaAyudaTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    // Registrar cambio de estado si aplica
    if (body.status && body.status !== ticket.status) {
      await this.prisma.mesaAyudaTicketStatusHistory.create({
        data: {
          ticketId,
          fromStatus: ticket.status,
          toStatus: body.status,
          changedByAgentId: user.id,
          reason: 'Actualización manual'
        }
      });
    }

    // Registrar cambio de asignación si aplica
    if (body.assignedToAgentId !== undefined && body.assignedToAgentId !== ticket.assignedToAgentId) {
      await this.prisma.mesaAyudaTicketAssignmentHistory.create({
        data: {
          ticketId,
          fromAgentId: ticket.assignedToAgentId,
          toAgentId: body.assignedToAgentId,
          assignedByAgentId: user.id,
          reason: 'Reasignación'
        }
      });
    }

    const updated = await this.prisma.mesaAyudaTicket.update({
      where: { id: ticketId },
      data: {
        status: body.status,
        priority: body.priority,
        assignedToAgentId: body.assignedToAgentId
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'mesa_ayuda.ticket_updated',
      entity: 'ticket',
      entityId: ticketId,
      metadata: {
        status: body.status,
        priority: body.priority,
        assignedToAgentId: body.assignedToAgentId
      }
    });

    return updated;
  }

  /**
   * Añadir mensaje a un ticket (público para solicitante, privado para agentes).
   */
  async addTicketMessage(
    user: AuthUser,
    ticketId: string,
    body: CreateTicketMessageRequest,
    senderEmail?: string,
    senderName?: string
  ): Promise<Ticket> {
    const ticket = await this.prisma.mesaAyudaTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    await this.prisma.mesaAyudaTicketMessage.create({
      data: {
        ticketId,
        senderEmail: senderEmail || user.email,
        senderName: senderName || user.email,
        content: body.content,
        isPublic: body.isPublic
      }
    });

    const updated = await this.prisma.mesaAyudaTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'mesa_ayuda.message_added',
      entity: 'ticket',
      entityId: ticketId,
      metadata: {
        public: body.isPublic
      }
    });

    return updated;
  }

  /**
   * Obtener dashboard (estadísticas para agentes).
   */
  async getDashboard(user: AuthUser): Promise<{
    openTickets: number;
    myAssignedTickets: number;
    overdueSLAs: number;
    allTickets: number;
  }> {
    const [openTickets, myAssignedTickets, overdueSLAs, allTickets] = await Promise.all([
      this.prisma.mesaAyudaTicket.count({
        where: { status: { in: ['abierto', 'en_proceso'] } }
      }),
      this.prisma.mesaAyudaTicket.count({
        where: { assignedToAgentId: user.id, status: { in: ['abierto', 'en_proceso'] } }
      }),
      this.prisma.mesaAyudaTicket.count({
        where: {
          status: { in: ['abierto', 'en_proceso'] },
          slaVencimientoAt: { lt: new Date() },
          slaCongeladoAt: null
        }
      }),
      this.prisma.mesaAyudaTicket.count({})
    ]);

    return {
      openTickets,
      myAssignedTickets,
      overdueSLAs,
      allTickets
    };
  }

  // ---------------------------------------------------------------------------
  // ADMIN: Departamentos, SLAs, Temas, KB, Respuestas
  // ---------------------------------------------------------------------------

  async createDepartment(user: AuthUser, body: CreateDepartmentRequest): Promise<Department> {
    const department = await this.prisma.mesaAyudaDepartment.create({
      data: {
        name: body.name,
        description: body.description,
        isActive: true
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'mesa_ayuda.department_created',
      entity: 'department',
      entityId: department.id,
      metadata: { name: body.name }
    });

    return department;
  }

  async updateDepartment(
    user: AuthUser,
    id: string,
    body: UpdateDepartmentRequest
  ): Promise<Department> {
    const department = await this.prisma.mesaAyudaDepartment.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        isActive: body.isActive
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'mesa_ayuda.department_updated',
      entity: 'department',
      entityId: id
    });

    return department;
  }

  async listDepartments(): Promise<Department[]> {
    return this.prisma.mesaAyudaDepartment.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async createHelpTopic(user: AuthUser, body: CreateHelpTopicRequest): Promise<HelpTopic> {
    const topic = await this.prisma.mesaAyudaHelpTopic.create({
      data: {
        departmentId: body.departmentId,
        name: body.name,
        description: body.description,
        displayOrder: body.displayOrder,
        isActive: true
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'mesa_ayuda.topic_created',
      entity: 'help_topic',
      entityId: topic.id,
      metadata: { name: body.name }
    });

    return topic;
  }

  async listHelpTopics(departmentId?: string): Promise<HelpTopic[]> {
    return this.prisma.mesaAyudaHelpTopic.findMany({
      where: departmentId ? { departmentId, isActive: true } : { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });
  }

  async listSLAs(departmentId?: string): Promise<SLA[]> {
    return this.prisma.mesaAyudaSLA.findMany({
      where: departmentId ? { departmentId } : undefined,
      orderBy: [{ departmentId: 'asc' }, { priority: 'asc' }]
    });
  }

  async createSLA(user: AuthUser, body: CreateSLARequest): Promise<SLA> {
    const sla = await this.prisma.mesaAyudaSLA.create({
      data: {
        departmentId: body.departmentId,
        priority: body.priority,
        responseTimeMinutes: body.responseTimeMinutes,
        resolutionTimeMinutes: body.resolutionTimeMinutes
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'mesa_ayuda.sla_created',
      entity: 'sla',
      entityId: sla.id,
      metadata: { priority: body.priority }
    });

    return sla;
  }

  async listKBArticles(topicId?: string): Promise<KBArticle[]> {
    return this.prisma.mesaAyudaKBArticle.findMany({
      where: topicId ? { topicId, isPublished: true } : { isPublished: true },
      orderBy: { viewCount: 'desc' }
    });
  }

  async createKBArticle(user: AuthUser, body: CreateKBArticleRequest): Promise<KBArticle> {
    const article = await this.prisma.mesaAyudaKBArticle.create({
      data: {
        topicId: body.topicId,
        title: body.title,
        content: body.content,
        excerpt: body.excerpt,
        isPublished: body.isPublished
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'mesa_ayuda.kb_article_created',
      entity: 'kb_article',
      entityId: article.id,
      metadata: { title: body.title }
    });

    return article;
  }

  async createCannedResponse(user: AuthUser, body: CreateCannedResponseRequest): Promise<CannedResponse> {
    const response = await this.prisma.mesaAyudaCannedResponse.create({
      data: {
        name: body.name,
        content: body.content,
        category: body.category,
        isActive: true
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'mesa_ayuda.canned_response_created',
      entity: 'canned_response',
      entityId: response.id
    });

    return response;
  }

  async listCannedResponses(category?: string): Promise<CannedResponse[]> {
    return this.prisma.mesaAyudaCannedResponse.findMany({
      where: category ? { category, isActive: true } : { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapTicketToDetail(ticket: any): TicketDetail {
    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }
    return {
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      departmentId: ticket.departmentId,
      topicId: ticket.topicId,
      status: ticket.status,
      priority: ticket.priority,
      subject: ticket.subject,
      requestorEmail: ticket.requestorEmail,
      requestorName: ticket.requestorName,
      description: ticket.description,
      assignedToAgentId: ticket.assignedToAgentId,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      slaVencimientoAt: ticket.slaVencimientoAt,
      slaCongeladoAt: ticket.slaCongeladoAt,
      departmentName: ticket.department.name,
      topicName: ticket.topic.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: ticket.messages.map((m: any) => ({
        id: m.id,
        senderEmail: m.senderEmail,
        senderName: m.senderName,
        content: m.content,
        isPublic: m.isPublic,
        createdAt: m.createdAt
      }))
    };
  }
}
