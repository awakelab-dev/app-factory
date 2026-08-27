import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  BadRequestException
} from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { CurrentUser, Roles } from '../../core/auth/auth.decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  createPanelTaskRequestSchema,
  updatePanelTaskRequestSchema,
  createTeamMemberRequestSchema,
  updateTeamMemberRequestSchema,
  type CreatePanelTaskRequest,
  type UpdatePanelTaskRequest,
  type CreateTeamMemberRequest,
  type UpdateTeamMemberRequest
} from './panel-prioridades.types';
import { PanelPrioritiesTasksService } from './panel-prioridades-tasks.service';
import { PanelPrioritiesScheduleService } from './panel-prioridades-schedule.service';
import { PanelPrioritiesTeamService } from './panel-prioridades-team.service';
import { PanelPrioritiesDelegationsService } from './panel-prioridades-delegations.service';
import { PanelPrioritiesKpisService } from './panel-prioridades-kpis.service';

/**
 * Panel de Prioridades (matriz de Eisenhower).
 * Todos los endpoints requieren rol `panel_admin` (o `admin` por backwards compatibility).
 * Cada endpoint filtra implícitamente por user_id (RLS + RBAC redundante).
 */
@Controller('panel-prioridades')
@Roles('panel_admin', 'admin')
export class PanelPrioritiesController {
  constructor(
    private readonly tasksService: PanelPrioritiesTasksService,
    private readonly scheduleService: PanelPrioritiesScheduleService,
    private readonly teamService: PanelPrioritiesTeamService,
    private readonly delegationsService: PanelPrioritiesDelegationsService,
    private readonly kpisService: PanelPrioritiesKpisService
  ) {}

  // ========================================================================
  // Tareas
  // ========================================================================

  /**
   * GET /api/panel-prioridades/tasks
   * Lista tareas abiertas del usuario con filtros opcionales.
   */
  @Get('tasks')
  async listTasks(
    @CurrentUser() user: AuthUser,
    @Query('quadrant') quadrant?: string,
    @Query('status') status?: string,
    @Query('origin') origin?: string
  ) {
    const filters = {
      quadrant: quadrant ? parseInt(quadrant, 10) : undefined,
      status,
      origin
    };
    return this.tasksService.listTasks(user, filters);
  }

  /**
   * GET /api/panel-prioridades/tasks/:id
   * Obtiene una tarea específica.
   */
  @Get('tasks/:id')
  async getTask(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.getTask(user, id);
  }

  /**
   * POST /api/panel-prioridades/tasks
   * Crea una nueva tarea.
   */
  @Post('tasks')
  @HttpCode(201)
  async createTask(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createPanelTaskRequestSchema)) body: CreatePanelTaskRequest
  ) {
    return this.tasksService.createTask(user, body);
  }

  /**
   * PUT /api/panel-prioridades/tasks/:id
   * Actualiza una tarea (incluyendo mover entre cuadrantes).
   */
  @Put('tasks/:id')
  async updateTask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePanelTaskRequestSchema)) body: UpdatePanelTaskRequest
  ) {
    return this.tasksService.updateTask(user, id, body);
  }

  /**
   * DELETE /api/panel-prioridades/tasks/:id
   * Marca una tarea como descartada (soft delete).
   * Si se pasa ?status=done, marca como done en lugar de discarded.
   */
  @Delete('tasks/:id')
  @HttpCode(204)
  async deleteTask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('status') status?: string
  ) {
    const newStatus = (status === 'done' ? 'done' : 'discarded') as 'done' | 'discarded';
    await this.tasksService.closeTask(user, id, newStatus);
  }

  /**
   * GET /api/panel-prioridades/tasks/:id/history
   * Obtiene el historial de cambios de una tarea.
   */
  @Get('tasks/:id/history')
  async getTaskHistory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.getTaskHistory(user, id);
  }

  // ========================================================================
  // Agenda (schedule blocks)
  // ========================================================================

  /**
   * GET /api/panel-prioridades/schedule
   * Obtiene la semana completa (matriz día×hora).
   */
  @Get('schedule')
  async getSchedule(@CurrentUser() user: AuthUser) {
    return this.scheduleService.getWeekSchedule(user);
  }

  /**
   * POST /api/panel-prioridades/schedule/:taskId/:day/:hour
   * Reserva un bloque de tiempo para una tarea.
   */
  @Post('schedule/:taskId/:day/:hour')
  @HttpCode(201)
  async reserveBlock(
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Param('day') day: string,
    @Param('hour') hour: string
  ) {
    const dayNum = parseInt(day, 10);
    const hourNum = parseInt(hour, 10);
    if (isNaN(dayNum) || isNaN(hourNum)) {
      throw new BadRequestException('day y hour deben ser números');
    }
    await this.scheduleService.reserveBlock(user, taskId, dayNum, hourNum);
    return { success: true };
  }

  /**
   * DELETE /api/panel-prioridades/schedule/:day/:hour
   * Libera un bloque de tiempo.
   */
  @Delete('schedule/:day/:hour')
  @HttpCode(204)
  async releaseBlock(
    @CurrentUser() user: AuthUser,
    @Param('day') day: string,
    @Param('hour') hour: string
  ) {
    const dayNum = parseInt(day, 10);
    const hourNum = parseInt(hour, 10);
    if (isNaN(dayNum) || isNaN(hourNum)) {
      throw new BadRequestException('day y hour deben ser números');
    }
    await this.scheduleService.releaseBlock(user, dayNum, hourNum);
  }

  // ========================================================================
  // Equipo
  // ========================================================================

  /**
   * GET /api/panel-prioridades/team
   * Lista el equipo registrado (miembros activos).
   */
  @Get('team')
  async listTeam(@CurrentUser() user: AuthUser) {
    return this.teamService.listTeamMembers(user);
  }

  /**
   * GET /api/panel-prioridades/team/:id
   * Obtiene un miembro del equipo.
   */
  @Get('team/:id')
  async getTeamMember(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.teamService.getTeamMember(user, id);
  }

  /**
   * POST /api/panel-prioridades/team
   * Añade una persona al equipo.
   */
  @Post('team')
  @HttpCode(201)
  async addTeamMember(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createTeamMemberRequestSchema)) body: CreateTeamMemberRequest
  ) {
    return this.teamService.addTeamMember(user, body);
  }

  /**
   * PUT /api/panel-prioridades/team/:id
   * Edita un miembro del equipo.
   */
  @Put('team/:id')
  async updateTeamMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTeamMemberRequestSchema)) body: UpdateTeamMemberRequest
  ) {
    return this.teamService.updateTeamMember(user, id, body);
  }

  /**
   * DELETE /api/panel-prioridades/team/:id
   * Desactiva un miembro del equipo (soft delete).
   */
  @Delete('team/:id')
  @HttpCode(204)
  async removeTeamMember(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.teamService.removeTeamMember(user, id);
  }

  // ========================================================================
  // Delegaciones
  // ========================================================================

  /**
   * GET /api/panel-prioridades/delegations
   * Lista todas las delegaciones del usuario.
   */
  @Get('delegations')
  async listDelegations(@CurrentUser() user: AuthUser) {
    return this.delegationsService.listDelegations(user);
  }

  /**
   * GET /api/panel-prioridades/delegations/:id
   * Obtiene una delegación específica.
   */
  @Get('delegations/:id')
  async getDelegation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.delegationsService.getDelegation(user, id);
  }

  /**
   * PUT /api/panel-prioridades/tasks/:id/delegate
   * Establece o cambia la delegación de una tarea (solo Q3).
   * Body: { delegatedToName: string|null, followUpDate?: date }
   */
  @Put('tasks/:id/delegate')
  async setDelegation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    const { delegatedToName, followUpDate } = body;
    return this.delegationsService.setDelegation(user, id, delegatedToName, followUpDate);
  }

  // ========================================================================
  // KPIs e indicadores
  // ========================================================================

  /**
   * GET /api/panel-prioridades/kpis
   * Obtiene los indicadores: recuento por cuadrante, horas reservadas, % Q2, vencidas, diagnósticos.
   */
  @Get('kpis')
  async getKpis(@CurrentUser() user: AuthUser) {
    return this.kpisService.getKpis(user);
  }
}
