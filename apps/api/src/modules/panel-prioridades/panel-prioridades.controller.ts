import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { CurrentUser, Roles } from '../../core/auth/auth.decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PanelPrioridadesService } from './panel-prioridades.service';
import {
  createTaskRequestSchema,
  updateTaskRequestSchema,
  createTeamMemberRequestSchema,
  updateTeamMemberRequestSchema,
  updateDelegationRequestSchema,
  scheduleBlockRequestSchema,
  type CreateTaskRequest,
  type UpdateTaskRequest,
  type CreateTeamMemberRequest,
  type UpdateTeamMemberRequest,
  type UpdateDelegationRequest,
  type ScheduleBlockRequest
} from './panel-prioridades.types';

/**
 * Panel de Prioridades API endpoints.
 *
 * Todos los endpoints requieren rol `panel_admin` (especificado en el manifest).
 * Todas las operaciones filtran por `userId` de JWT (monouser hoy, multi-usuario en futuro).
 *
 * Rutas:
 * - GET  /api/panel-prioridades/tasks
 * - POST /api/panel-prioridades/tasks
 * - PUT  /api/panel-prioridades/tasks/:id
 * - DELETE /api/panel-prioridades/tasks/:id
 * - GET  /api/panel-prioridades/tasks/:id/history
 * - GET  /api/panel-prioridades/schedule
 * - POST /api/panel-prioridades/schedule/:taskId/:day/:hour
 * - GET  /api/panel-prioridades/team
 * - POST /api/panel-prioridades/team
 * - PUT  /api/panel-prioridades/team/:id
 * - DELETE /api/panel-prioridades/team/:id
 * - PUT  /api/panel-prioridades/tasks/:id/delegate
 * - GET  /api/panel-prioridades/kpis
 */
@Controller('api/panel-prioridades')
@Roles('panel_admin')
export class PanelPrioridadesController {
  constructor(private readonly service: PanelPrioridadesService) {}

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  @Get('tasks')
  async listTasks(
    @CurrentUser() user: AuthUser,
    @Query('quadrant') quadrant?: string,
    @Query('status') status?: 'open' | 'done' | 'discarded',
    @Query('origin') origin?: string
  ) {
    return this.service.listTasks(user, {
      quadrant: quadrant ? parseInt(quadrant, 10) : undefined,
      status,
      origin
    });
  }

  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  async createTask(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createTaskRequestSchema)) body: CreateTaskRequest
  ) {
    return this.service.createTask(user, body);
  }

  @Put('tasks/:id')
  async updateTask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTaskRequestSchema)) body: UpdateTaskRequest
  ) {
    return this.service.updateTask(user, id, body);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.service.deleteTask(user, id);
  }

  @Get('tasks/:id/history')
  async getTaskHistory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getTaskHistory(user, id);
  }

  // ---------------------------------------------------------------------------
  // Schedule (Time-blocking)
  // ---------------------------------------------------------------------------

  @Get('schedule')
  async getScheduleGrid(@CurrentUser() user: AuthUser) {
    return this.service.getScheduleGrid(user);
  }

  @Post('schedule/:taskId/:day/:hour')
  @HttpCode(HttpStatus.NO_CONTENT)
  async toggleScheduleBlock(
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Param('day') day: string,
    @Param('hour') hour: string,
    @Body(new ZodValidationPipe(scheduleBlockRequestSchema.optional())) body?: ScheduleBlockRequest
  ) {
    await this.service.toggleScheduleBlock(user, taskId, parseInt(day, 10), parseInt(hour, 10), body);
  }

  // ---------------------------------------------------------------------------
  // Team
  // ---------------------------------------------------------------------------

  @Get('team')
  async getTeam(@CurrentUser() user: AuthUser) {
    return this.service.getTeam(user);
  }

  @Post('team')
  @HttpCode(HttpStatus.CREATED)
  async addTeamMember(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createTeamMemberRequestSchema)) body: CreateTeamMemberRequest
  ) {
    return this.service.addTeamMember(user, body);
  }

  @Put('team/:id')
  async updateTeamMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTeamMemberRequestSchema)) body: UpdateTeamMemberRequest
  ) {
    return this.service.updateTeamMember(user, id, body);
  }

  @Delete('team/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTeamMember(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.service.deleteTeamMember(user, id);
  }

  // ---------------------------------------------------------------------------
  // Delegations
  // ---------------------------------------------------------------------------

  @Put('tasks/:id/delegate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setDelegation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDelegationRequestSchema)) body: UpdateDelegationRequest
  ) {
    await this.service.setDelegation(user, id, body);
  }

  // ---------------------------------------------------------------------------
  // KPIs
  // ---------------------------------------------------------------------------

  @Get('kpis')
  async getKPIs(@CurrentUser() user: AuthUser) {
    return this.service.getKPIs(user);
  }
}
