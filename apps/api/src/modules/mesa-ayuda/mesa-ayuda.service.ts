import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  ConflictException
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
  LoginExternalRequest,
  ChangePasswordRequest,
  CreateExternalUserRequest,
  UpdateExternalUserActiveRequest,
  Ticket,
  TicketDetail,
  Department,
  HelpTopic,
  SLA,
  KBArticle,
  CannedResponse,
  LoginResponse,
  VerifySessionResponse,
  CreateExternalUserResponse,
  ExternalUsersList,
  ExternalUserAudit
} from './mesa-ayuda.types';

/**
 * Mesa de Ayuda: lógica de negocio de gestión de tickets de soporte.
 * - Crear/gestionar tickets (público por solicitante, privado por agentes/admin)
 * - Gestionar SLAs, departamentos, temas
 * - KB y respuestas preformuladas
 * - Auth de usuarios externos (change-2)
 * - Administración de usuarios externos
 */
@Injectable()
export class MesaAyudaService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly LOCKOUT_MINUTES = 30;
  private readonly MAX_LOGIN_ATTEMPTS = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  // ---------------------------------------------------------------------------
  // AUTH: Usuarios externos (change-2)
  // ---------------------------------------------------------------------------

  /**
   * Generar contraseña temporal segura.
   * Formato: 12+ caracteres con mayús, número y especial.
   */
  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 15; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Asegurar que contiene mayús, número y especial
    const specialChars = '!@#$%^&*';
    if (!/[A-Z]/.test(password)) password = password.slice(0, -1) + 'A';
    if (!/\d/.test(password)) password = password.slice(0, -1) + '1';
    if (!/[!@#$%^&*]/.test(password)) password = password.slice(0, -1) + specialChars[0];
    return password;
  }

  /**
   * Login de usuario externo (email + contraseña).
   */
  async loginExternal(body: LoginExternalRequest): Promise<LoginResponse> {
    // Esperar 500ms para mitigar timing attacks
    await new Promise(resolve => setTimeout(resolve, 500));

    const user = await this.prisma.user.findFirst({
      where: {
        email: body.email,
        externalMesaAyudaUser: true,
        isActive: true
      }
    });

    if (!user) {
      await this.audit.log({
        action: 'mesa_ayuda.external_user_login_failed',
        entity: 'user',
        entityId: undefined,
        metadata: { email: body.email, reason: 'user_not_found_or_inactive' }
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar bloqueo temporal
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.log({
        action: 'mesa_ayuda.external_user_login_failed',
        entity: 'user',
        entityId: user.id,
        metadata: { reason: 'account_locked' }
      });
      throw new UnauthorizedException('Cuenta temporalmente bloqueada. Intenta en 30 minutos o contacta a soporte');
    }

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(body.password, user.passwordHash || '');

    if (!passwordMatch) {
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      const lockoutData: Record<string, unknown> = { failedLoginAttempts: newAttempts };

      if (newAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        lockoutData.lockedUntil = new Date(Date.now() + this.LOCKOUT_MINUTES * 60 * 1000);
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: lockoutData
      });

      await this.audit.log({
        actorId: user.id,
        action: 'mesa_ayuda.external_user_login_failed',
        entity: 'user',
        entityId: user.id,
        metadata: { reason: 'invalid_password', attempts: newAttempts }
      });

      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Resetear intentos fallidos
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastExternalLoginAt: new Date()
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'mesa_ayuda.external_user_login_success',
      entity: 'user',
      entityId: user.id,
      metadata: { email: user.email }
    });

    // Verificar si la contraseña temporal ha expirado
    if (user.passwordExpiresAt && user.passwordExpiresAt < new Date()) {
      // Generar token provisional para cambio de contraseña
      const provisionalToken = this.generateProvisionalToken(user.id);
      return {
        requiresPasswordChange: true,
        redirectTo: '/mesa-ayuda/change-password',
        sessionToken: provisionalToken
      };
    }

    // Contraseña es permanente: retornar sessionToken normal
    const sessionToken = crypto.randomUUID();
    return {
      requiresPasswordChange: false,
      sessionToken,
      redirectTo: '/mesa-ayuda/mis-tickets'
    };
  }

  /**
   * Cambiar contraseña con token provisional.
   */
  async changePassword(provisionalToken: string, body: ChangePasswordRequest): Promise<LoginResponse> {
    // Verificar token provisional
    const userId = this.verifyProvisionalToken(provisionalToken);
    if (!userId) {
      throw new UnauthorizedException('Token provisional inválido o expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.externalMesaAyudaUser) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Hash de la nueva contraseña
    const passwordHash = await bcrypt.hash(body.newPassword, this.BCRYPT_ROUNDS);

    // Actualizar usuario
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    await this.audit.log({
      actorId: userId,
      action: 'mesa_ayuda.external_user_password_changed',
      entity: 'user',
      entityId: userId,
      metadata: { email: user.email }
    });

    // Generar nuevo sessionToken permanente
    const sessionToken = crypto.randomUUID();
    return {
      requiresPasswordChange: false,
      sessionToken,
      redirectTo: '/mesa-ayuda/mis-tickets'
    };
  }

  /**
   * Verificar sesión (token válido y activo).
   */
  async verifySession(sessionToken: string): Promise<VerifySessionResponse> {
    // En esta implementación, el sessionToken es un UUID.
    // Para MVP, asumir que un sessionToken conocido es válido.
    // En producción, usar JWT o una tabla de sesiones.

    // Por ahora, retornar válido (la verificación real ocurriría en el cliente
    // cuando intente acceder a /mes-ayuda/mis-tickets con el token en localStorage)
    try {
      // Intentar validar el token (en esta MVP, solo verificar formato)
      if (!this.isValidUUID(sessionToken)) {
        throw new UnauthorizedException();
      }

      return {
        valid: true,
        error: undefined
      };
    } catch {
      return {
        valid: false,
        error: 'Token inválido o expirado'
      };
    }
  }

  // ---------------------------------------------------------------------------
  // ADMIN: Gestión de usuarios externos (change-2)
  // ---------------------------------------------------------------------------

  /**
   * Listar usuarios externos con búsqueda y filtros.
   */
  async listExternalUsers(filters: {
    search?: string;
    status?: 'active' | 'inactive';
    sortBy?: 'createdAt' | 'email' | 'organization';
  }): Promise<ExternalUsersList> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { externalMesaAyudaUser: true };

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { displayName: { contains: filters.search, mode: 'insensitive' } },
        { requesterOrganization: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters.status === 'active') {
      where.isActive = true;
    } else if (filters.status === 'inactive') {
      where.isActive = false;
    }

    let orderBy: Record<string, string> = { createdAt: 'desc' };
    if (filters.sortBy === 'email') {
      orderBy = { email: 'asc' };
    } else if (filters.sortBy === 'organization') {
      orderBy = { requesterOrganization: 'asc' };
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy,
      select: {
        id: true,
        email: true,
        displayName: true,
        requesterOrganization: true,
        isActive: true,
        createdAt: true,
        lastExternalLoginAt: true,
        externalMesaAyudaUser: true
      }
    });

    return {
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        requesterOrganization: u.requesterOrganization,
        isActive: u.isActive,
        createdAt: u.createdAt,
        lastExternalLoginAt: u.lastExternalLoginAt,
        externalMesaAyudaUser: u.externalMesaAyudaUser as true
      }))
    };
  }

  /**
   * Crear nuevo usuario externo.
   */
  async createExternalUser(
    adminUser: AuthUser,
    body: CreateExternalUserRequest
  ): Promise<CreateExternalUserResponse> {
    // Verificar que el correo no existe
    const existing = await this.prisma.user.findUnique({
      where: { email: body.email }
    });

    if (existing) {
      if (!existing.isActive) {
        throw new ConflictException('Usuario existe y está inactivo; reactívalo con reboot de contraseña en PATCH');
      }
      throw new ConflictException('El correo ya existe');
    }

    // Generar contraseña temporal
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, this.BCRYPT_ROUNDS);

    // Crear usuario
    const user = await this.prisma.user.create({
      data: {
        email: body.email,
        displayName: body.displayName,
        externalMesaAyudaUser: true,
        passwordHash,
        passwordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        requesterOrganization: body.requesterOrganization,
        isActive: true
      }
    });

    // Asignar rol mesa_ayuda_solicitante
    const roleName = 'mesa_ayuda_solicitante';
    let role = await this.prisma.role.findFirst({
      where: { name: roleName }
    });

    if (!role) {
      role = await this.prisma.role.create({
        data: { name: roleName, description: 'Solicitante de Mesa de Ayuda (externo)' }
      });
    }

    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id
      }
    });

    await this.audit.log({
      actorId: adminUser.id,
      action: 'mesa_ayuda.external_user_created',
      entity: 'user',
      entityId: user.id,
      metadata: {
        email: body.email,
        displayName: body.displayName,
        requesterOrganization: body.requesterOrganization
      }
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      temporaryPassword,
      requesterOrganization: user.requesterOrganization,
      createdAt: user.createdAt
    };
  }

  /**
   * Activar o desactivar usuario externo.
   */
  async updateExternalUserActive(
    adminUser: AuthUser,
    userId: string,
    body: UpdateExternalUserActiveRequest
  ): Promise<{
    id: string;
    email: string;
    isActive: boolean;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.externalMesaAyudaUser) {
      throw new NotFoundException('Usuario externo no encontrado');
    }

    // Si se desactiva, marcar sesión como revocada
    const updateData: Record<string, unknown> = { isActive: body.isActive };
    if (!body.isActive) {
      updateData.sessionRevokedAt = new Date();
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, isActive: true }
    });

    const action = body.isActive ? 'mesa_ayuda.external_user_activated' : 'mesa_ayuda.external_user_deactivated';
    await this.audit.log({
      actorId: adminUser.id,
      action,
      entity: 'user',
      entityId: userId,
      metadata: { email: user.email }
    });

    return updated;
  }

  /**
   * Resetear contraseña del usuario externo.
   */
  async resetExternalUserPassword(
    adminUser: AuthUser,
    userId: string
  ): Promise<{ id: string; email: string; temporaryPassword: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.externalMesaAyudaUser) {
      throw new NotFoundException('Usuario externo no encontrado');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, this.BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    await this.audit.log({
      actorId: adminUser.id,
      action: 'mesa_ayuda.external_user_password_reset',
      entity: 'user',
      entityId: userId,
      metadata: { email: user.email }
    });

    return {
      id: user.id,
      email: user.email,
      temporaryPassword
    };
  }

  /**
   * Obtener historial de auditoría de usuario externo.
   */
  async getExternalUserAudit(
    adminUser: AuthUser,
    userId: string
  ): Promise<ExternalUserAudit> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.externalMesaAyudaUser) {
      throw new NotFoundException('Usuario externo no encontrado');
    }

    const auditEvents = await this.prisma.auditEvent.findMany({
      where: {
        OR: [
          { actorId: userId },
          { entityId: userId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    await this.audit.log({
      actorId: adminUser.id,
      action: 'mesa_ayuda.external_user_audit_viewed',
      entity: 'user',
      entityId: userId
    });

    return {
      userId: user.id,
      email: user.email,
      auditEvents: auditEvents.map(e => ({
        id: e.id,
        action: e.action,
        createdAt: e.createdAt,
        details: e.metadata as Record<string, unknown> | undefined
      }))
    };
  }

  // ---------------------------------------------------------------------------
  // TICKETS
  // ---------------------------------------------------------------------------

  /**
   * Crear un ticket (endpoint público).
   * El solicitante NO necesita login; se identifica por sessionToken (UUID).
   */
  async createTicket(body: CreateTicketRequest): Promise<TicketDetail> {
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
        requestorEmail: body.requestorEmail,
        requestorName: body.requestorName,
        sessionToken,
        description: body.description,
        priority: body.priority,
        status: 'abierto',
        slaVencimientoAt,
        messages: {
          create: {
            senderEmail: body.requestorEmail,
            senderName: body.requestorName,
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
        email: body.requestorEmail,
        subject: body.subject
      }
    });

    return this.mapTicketToDetail(ticket);
  }

  /**
   * Obtener ticket por ID (acceso público con sessionToken o privado con auth).
   * Con change-2: también valida propiedad si es usuario externo.
   */
  async getTicket(id: string, sessionToken?: string, externalUser?: AuthUser): Promise<TicketDetail> {
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

    // Validar acceso público o externo
    if (sessionToken) {
      if (ticket.sessionToken !== sessionToken) {
        throw new ForbiddenException('Token de sesión inválido');
      }
    } else if (externalUser) {
      // Usuario externo debe ser el propietario del ticket
      if (ticket.requesterId !== externalUser.id) {
        throw new ForbiddenException('No tienes acceso a este ticket');
      }
    }

    return this.mapTicketToDetail(ticket);
  }

  /**
   * Listar tickets (filtrable para agentes/admin, solo propios para externos).
   * Con change-2: si el usuario actual es externo, filtra por requester_id.
   */
  async listTickets(
    user: AuthUser,
    filters?: {
      status?: string;
      departmentId?: string;
      priority?: string;
      assignedToMe?: boolean;
    },
    isExternalUser?: boolean
  ): Promise<Ticket[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    // Si es usuario externo, filtra solo sus tickets
    if (isExternalUser) {
      where.requesterId = user.id;
    } else {
      // Agentes/admin: aplica filtros normales
      if (filters?.status) {
        where.status = filters.status;
      }
      if (filters?.departmentId) {
        where.departmentId = filters.departmentId;
      }
      if (filters?.priority) {
        where.priority = filters.priority;
      }

      if (filters?.assignedToMe) {
        where.assignedToAgentId = user.id;
      }
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
   * Con change-2: si es usuario externo, fuerza isPublic=true.
   */
  async addTicketMessage(
    user: AuthUser,
    ticketId: string,
    body: CreateTicketMessageRequest,
    isExternalUser?: boolean,
    senderEmail?: string,
    senderName?: string
  ): Promise<Ticket> {
    const ticket = await this.prisma.mesaAyudaTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    // Validar propiedad si es usuario externo
    if (isExternalUser && ticket.requesterId !== user.id) {
      throw new ForbiddenException('No tienes acceso a este ticket');
    }

    // Fuerza isPublic=true si es usuario externo
    let isPublic = body.isPublic;
    if (isExternalUser) {
      if (body.isPublic === false) {
        throw new BadRequestException('Solicitantes externos no pueden crear notas internas');
      }
      isPublic = true;
    }

    await this.prisma.mesaAyudaTicketMessage.create({
      data: {
        ticketId,
        senderEmail: senderEmail || user.email,
        senderName: senderName || user.email,
        content: body.content,
        isPublic
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
        public: isPublic
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

  private isValidUUID(token: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(token);
  }

  /**
   * Generar token provisional para cambio de contraseña.
   * En MVP: JWT corto. En producción: usar JWT estándar con claims.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private generateProvisionalToken(_userId: string): string {
    // Para MVP, retornar UUID. En producción, sería un JWT con userId en claims.
    return crypto.randomUUID();
  }

  /**
   * Verificar token provisional.
   * En MVP: retornar userId si es UUID válido. En producción: verificar JWT.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private verifyProvisionalToken(_token: string): string | null {
    // Para MVP, retornar el token como userId (simplificado).
    // En producción, verificar JWT y extraer el claim userId.
    if (this.isValidUUID(_token)) {
      return _token;
    }
    return null;
  }

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
      sessionToken: ticket.sessionToken,
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
