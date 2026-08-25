import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query
} from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { CurrentUser, Roles } from '../../core/auth/auth.decorators';
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
  type CreateTicketRequest,
  type CreateTicketMessageRequest,
  type UpdateTicketRequest,
  type CreateDepartmentRequest,
  type UpdateDepartmentRequest,
  type CreateHelpTopicRequest,
  type CreateSLARequest,
  type CreateKBArticleRequest,
  type CreateCannedResponseRequest
} from './mesa-ayuda.types';

/**
 * Mesa de Ayuda (spec-tecnica.md `mesa-ayuda`): gestión de tickets de soporte
 * técnico con SLA, asignación de agentes, base de conocimiento (KB) y respuestas
 * preformuladas.
 *
 * Patrón de acceso: TODO el módulo va tras el login de la plataforma. El
 * solicitante se autentica con su propia cuenta (rol `mesa_ayuda_solicitante`)
 * y su identidad sale del JWT, no de datos que él teclee. No hay endpoints
 * `@Public()` ni token de sesión por enlace.
 *
 * Roles de manifest: `mesa_ayuda_solicitante` (abre y consulta sus propias
 * peticiones), `mesa_ayuda_agente` (puede ver/actualizar tickets de sus
 * departamentos) y `mesa_ayuda_admin` (configuración completa).
 */
@Controller('mesa-ayuda')
export class MesaAyudaController {
  constructor(private readonly service: MesaAyudaService) {}

  // ---------------------------------------------------------------------------
  // ENDPOINTS DEL SOLICITANTE (autenticado)
  // ---------------------------------------------------------------------------

  /**
   * POST /mesa-ayuda/tickets
   * Crear una petición. El solicitante va autenticado: su nombre y su correo
   * se derivan del JWT, nunca del cuerpo de la petición.
   */
  @Roles('mesa_ayuda_solicitante', 'mesa_ayuda_agente', 'mesa_ayuda_admin')
  @Post('tickets')
  createTicket(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createTicketRequestSchema))
    body: CreateTicketRequest
  ) {
    return this.service.createTicket(user, body);
  }

  /**
   * GET /mesa-ayuda/tickets/:id
   * Recuperar un ticket. El solicitante solo accede a los suyos y solo ve los
   * mensajes públicos; agentes y administradores ven además las notas internas.
   */
  @Roles('mesa_ayuda_solicitante', 'mesa_ayuda_agente', 'mesa_ayuda_admin')
  @Get('tickets/:id')
  getTicket(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getTicket(id, user);
  }

  /**
   * GET /mesa-ayuda/help-topics?departmentId=<uuid>
   * Listar temas de soporte (para el desplegable del formulario).
   */
  @Roles('mesa_ayuda_solicitante', 'mesa_ayuda_agente', 'mesa_ayuda_admin')
  @Get('help-topics')
  listHelpTopics(@Query('departmentId') departmentId?: string) {
    return this.service.listHelpTopics(departmentId);
  }

  /**
   * GET /mesa-ayuda/kb?topicId=<uuid>
   * Listar artículos de la base de conocimiento.
   */
  @Roles('mesa_ayuda_solicitante', 'mesa_ayuda_agente', 'mesa_ayuda_admin')
  @Get('kb')
  listKBArticles(@Query('topicId') topicId?: string) {
    return this.service.listKBArticles(topicId);
  }

  /**
   * GET /mesa-ayuda/departments
   * Listar departamentos activos (para el desplegable del formulario).
   */
  @Roles('mesa_ayuda_solicitante', 'mesa_ayuda_agente', 'mesa_ayuda_admin')
  @Get('departments')
  listDepartments() {
    return this.service.listDepartments();
  }

  // ---------------------------------------------------------------------------
  // ENDPOINTS DE AGENTES Y ADMINISTRACIÓN
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
   * GET /mesa-ayuda/admin/slas?departmentId=<uuid>
   * Listar los SLA configurados.
   */
  @Roles('mesa_ayuda_admin')
  @Get('admin/slas')
  listSLAs(@Query('departmentId') departmentId?: string) {
    return this.service.listSLAs(departmentId);
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
}
