import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Headers,
  UnauthorizedException
} from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { Public, CurrentUser, Roles } from '../../core/auth/auth.decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { MesaAyudaService } from './mesa-ayuda.service';
import {
  createTicketRequestSchema,
  createTicketMessageRequestSchema,
  updateTicketRequestSchema,
  createDepartmentRequestSchema,
  updateDepartmentRequestSchema,
  createHelpTopicRequestSchema,
  createSLARequestSchema,
  createKBArticleRequestSchema,
  createCannedResponseRequestSchema,
  loginExternalSchema,
  changePasswordSchema,
  createExternalUserSchema,
  updateExternalUserActiveSchema,
  type CreateTicketRequest,
  type CreateTicketMessageRequest,
  type UpdateTicketRequest,
  type CreateDepartmentRequest,
  type UpdateDepartmentRequest,
  type CreateHelpTopicRequest,
  type CreateSLARequest,
  type CreateKBArticleRequest,
  type CreateCannedResponseRequest,
  type LoginExternalRequest,
  type ChangePasswordRequest,
  type CreateExternalUserRequest,
  type UpdateExternalUserActiveRequest
} from './mesa-ayuda.types';

/**
 * Mesa de Ayuda (spec-tecnica.md `mesa-ayuda`): gestión de tickets de soporte
 * técnico con SLA, asignación de agentes, base de conocimiento (KB) y respuestas
 * preformuladas. Patrón de acceso: endpoints públicos sin auth (crear ticket,
 * ver ticket por token), endpoints privados para agentes/admin.
 *
 * Roles nuevos de manifest: `mesa_ayuda_agente` (puede ver/actualizar tickets)
 * y `mesa_ayuda_admin` (configuración completa).
 */
@Controller('mesa-ayuda')
export class MesaAyudaController {
  constructor(private readonly service: MesaAyudaService) {}

  // ---------------------------------------------------------------------------
  // ENDPOINTS PÚBLICOS: Auth de usuarios externos (change-2)
  // ---------------------------------------------------------------------------

  /**
   * POST /api/mesa-ayuda/auth/login
   * Endpoint público: login de usuario externo (email + contraseña).
   * Retorna sessionToken o requiere cambio de contraseña si es temporal.
   */
  @Public()
  @Post('auth/login')
  loginExternal(
    @Body(new ZodValidationPipe(loginExternalSchema))
    body: LoginExternalRequest
  ) {
    return this.service.loginExternal(body);
  }

  /**
   * POST /api/mesa-ayuda/auth/change-password
   * Endpoint público: cambiar contraseña (requiere token provisional).
   * Header: Authorization: Bearer <provisional_token>
   */
  @Public()
  @Post('auth/change-password')
  changePassword(
    @Headers('authorization') authHeader: string,
    @Body(new ZodValidationPipe(changePasswordSchema))
    body: ChangePasswordRequest
  ) {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token provisional requerido');
    }
    const token = authHeader.slice(7);
    return this.service.changePassword(token, body);
  }

  /**
   * GET /api/mesa-ayuda/auth/verify-session
   * Endpoint público: verificar si un sessionToken es válido.
   * Query: token=<sessionToken>
   */
  @Public()
  @Get('auth/verify-session')
  verifySession(@Query('token') token?: string) {
    if (!token) {
      throw new UnauthorizedException('Token requerido');
    }
    return this.service.verifySession(token);
  }

  // ---------------------------------------------------------------------------
  // ENDPOINT PÚBLICO: Crear ticket (sin login)
  // ---------------------------------------------------------------------------

  /**
   * POST /mesa-ayuda/tickets
   * Endpoint público: crear un ticket de soporte.
   * El solicitante se identifica por email/nombre; recibe un sessionToken para
   * recuperar su ticket sin login.
   */
  @Public()
  @Post('tickets')
  createTicket(
    @Body(new ZodValidationPipe(createTicketRequestSchema))
    body: CreateTicketRequest
  ) {
    return this.service.createTicket(body);
  }

  /**
   * GET /mesa-ayuda/tickets/:id?sessionToken=<uuid>
   * Endpoint público: recuperar ticket por ID + sessionToken (sin login).
   * El solicitante solo ve sus propios datos y mensajes públicos.
   */
  @Public()
  @Get('tickets/:id')
  getTicketPublic(
    @Param('id') id: string,
    @Query('sessionToken') sessionToken?: string
  ) {
    return this.service.getTicket(id, sessionToken);
  }

  /**
   * GET /mesa-ayuda/help-topics?departmentId=<uuid>
   * Endpoint público: listar temas de soporte (para dropdown en formulario).
   */
  @Public()
  @Get('help-topics')
  listHelpTopics(@Query('departmentId') departmentId?: string) {
    return this.service.listHelpTopics(departmentId);
  }

  /**
   * GET /mesa-ayuda/kb?topicId=<uuid>
   * Endpoint público: listar artículos de KB (base de conocimiento).
   */
  @Public()
  @Get('kb')
  listKBArticles(@Query('topicId') topicId?: string) {
    return this.service.listKBArticles(topicId);
  }

  /**
   * GET /mesa-ayuda/departments
   * Endpoint público: listar departamentos activos (para dropdown).
   */
  @Public()
  @Get('departments')
  listDepartments() {
    return this.service.listDepartments();
  }

  // ---------------------------------------------------------------------------
  // ENDPOINTS PRIVADOS: Agentes/Admin
  // ---------------------------------------------------------------------------

  /**
   * GET /mesa-ayuda/dashboard
   * Dashboard para agentes (métricas rápidas).
   */
  @Roles('mesa_ayuda_agente', 'mesa_ayuda_admin')
  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.service.getDashboard(user);
  }

  /**
   * GET /mesa-ayuda/tickets-list
   * Listar tickets con filtros (estado, departamento, prioridad, asignación).
   */
  @Roles('mesa_ayuda_agente', 'mesa_ayuda_admin')
  @Get('tickets-list')
  listTickets(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Query('priority') priority?: string,
    @Query('assignedToMe') assignedToMe?: string
  ) {
    return this.service.listTickets(user, {
      status,
      departmentId,
      priority,
      assignedToMe: assignedToMe === 'true'
    });
  }

  /**
   * PATCH /mesa-ayuda/tickets/:id
   * Actualizar estado/prioridad/asignación de un ticket.
   */
  @Roles('mesa_ayuda_agente', 'mesa_ayuda_admin')
  @Patch('tickets/:id')
  updateTicket(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTicketRequestSchema))
    body: UpdateTicketRequest
  ) {
    return this.service.updateTicket(user, id, body);
  }

  /**
   * POST /mesa-ayuda/tickets/:id/messages
   * Añadir mensaje a un ticket (puede ser público o nota interna).
   */
  @Roles('mesa_ayuda_agente', 'mesa_ayuda_admin')
  @Post('tickets/:id/messages')
  addTicketMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createTicketMessageRequestSchema))
    body: CreateTicketMessageRequest
  ) {
    return this.service.addTicketMessage(user, id, body);
  }

  // ---------------------------------------------------------------------------
  // ENDPOINTS ADMIN: Configuración
  // ---------------------------------------------------------------------------

  /**
   * POST /mesa-ayuda/admin/departments
   * Crear departamento.
   */
  @Roles('mesa_ayuda_admin')
  @Post('admin/departments')
  createDepartment(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createDepartmentRequestSchema))
    body: CreateDepartmentRequest
  ) {
    return this.service.createDepartment(user, body);
  }

  /**
   * PATCH /mesa-ayuda/admin/departments/:id
   * Actualizar departamento.
   */
  @Roles('mesa_ayuda_admin')
  @Patch('admin/departments/:id')
  updateDepartment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDepartmentRequestSchema))
    body: UpdateDepartmentRequest
  ) {
    return this.service.updateDepartment(user, id, body);
  }

  /**
   * POST /mesa-ayuda/admin/help-topics
   * Crear tema de soporte.
   */
  @Roles('mesa_ayuda_admin')
  @Post('admin/help-topics')
  createHelpTopic(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createHelpTopicRequestSchema))
    body: CreateHelpTopicRequest
  ) {
    return this.service.createHelpTopic(user, body);
  }

  /**
   * POST /mesa-ayuda/admin/slas
   * Crear SLA para un departamento + prioridad.
   */
  @Roles('mesa_ayuda_admin')
  @Post('admin/slas')
  createSLA(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createSLARequestSchema))
    body: CreateSLARequest
  ) {
    return this.service.createSLA(user, body);
  }

  /**
   * POST /mesa-ayuda/admin/kb-articles
   * Crear artículo de KB.
   */
  @Roles('mesa_ayuda_admin')
  @Post('admin/kb-articles')
  createKBArticle(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createKBArticleRequestSchema))
    body: CreateKBArticleRequest
  ) {
    return this.service.createKBArticle(user, body);
  }

  /**
   * POST /mesa-ayuda/admin/canned-responses
   * Crear respuesta preformulada.
   */
  @Roles('mesa_ayuda_admin')
  @Post('admin/canned-responses')
  createCannedResponse(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCannedResponseRequestSchema))
    body: CreateCannedResponseRequest
  ) {
    return this.service.createCannedResponse(user, body);
  }

  /**
   * GET /mesa-ayuda/admin/canned-responses
   * Listar respuestas preformuladas.
   */
  @Roles('mesa_ayuda_admin')
  @Get('admin/canned-responses')
  listCannedResponses(@Query('category') category?: string) {
    return this.service.listCannedResponses(category);
  }

  // ---------------------------------------------------------------------------
  // ENDPOINTS ADMIN: Gestión de usuarios externos (change-2)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/mesa-ayuda/admin/external-users
   * Listar usuarios externos con búsqueda y filtros.
   */
  @Roles('mesa_ayuda_admin')
  @Get('admin/external-users')
  listExternalUsers(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string
  ) {
    return this.service.listExternalUsers({
      search,
      status: status as 'active' | 'inactive' | undefined,
      sortBy: sortBy as 'createdAt' | 'email' | 'organization' | undefined
    });
  }

  /**
   * POST /api/mesa-ayuda/admin/external-users
   * Crear nuevo usuario externo.
   */
  @Roles('mesa_ayuda_admin')
  @Post('admin/external-users')
  createExternalUser(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createExternalUserSchema))
    body: CreateExternalUserRequest
  ) {
    return this.service.createExternalUser(user, body);
  }

  /**
   * PATCH /api/mesa-ayuda/admin/external-users/:id/active
   * Activar o desactivar usuario externo.
   */
  @Roles('mesa_ayuda_admin')
  @Patch('admin/external-users/:id/active')
  updateExternalUserActive(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExternalUserActiveSchema))
    body: UpdateExternalUserActiveRequest
  ) {
    return this.service.updateExternalUserActive(user, id, body);
  }

  /**
   * PATCH /api/mesa-ayuda/admin/external-users/:id/password-reset
   * Resetear contraseña a una temporal nueva.
   */
  @Roles('mesa_ayuda_admin')
  @Patch('admin/external-users/:id/password-reset')
  resetExternalUserPassword(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string
  ) {
    return this.service.resetExternalUserPassword(user, id);
  }

  /**
   * GET /api/mesa-ayuda/admin/external-users/:id/audit
   * Ver historial de auditoría del usuario externo.
   */
  @Roles('mesa_ayuda_admin')
  @Get('admin/external-users/:id/audit')
  getExternalUserAudit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string
  ) {
    return this.service.getExternalUserAudit(user, id);
  }
}
