import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser } from '../../core/auth/auth.decorators';
import { FocusSessionsService } from './focus-flow-sessions.service';
import { FocusSettingsService } from './focus-flow-settings.service';
import { FocusStatsService } from './focus-flow-stats.service';
import { FocusTasksService } from './focus-flow-tasks.service';
import {
  createFocusSessionRequestSchema,
  createFocusTaskRequestSchema,
  focusPerformanceRangeSchema,
  updateFocusSettingsRequestSchema,
  updateFocusTaskRequestSchema,
  type CreateFocusSessionRequest,
  type CreateFocusTaskRequest,
  type FocusDashboard,
  type FocusPerformance,
  type FocusPerformanceRange,
  type FocusSession,
  type FocusSettings,
  type FocusTask,
  type ImportFocusTasksResponse,
  type UpdateFocusSettingsRequest,
  type UpdateFocusTaskRequest
} from './focus-flow.types';

const DEFAULT_PERFORMANCE_RANGE: FocusPerformanceRange = 'week';

/**
 * Temporizador Pomodoro personal (spec-tecnica.md `focus-flow`): el patrón
 * de aislamiento por fila más estricto de la plataforma hasta ahora — cada
 * endpoint filtra implícitamente por `request.user.id` (JWT); ninguno acepta
 * `userId` como parámetro, y ni siquiera `admin` ve datos de otra persona
 * (gate funcional, decisión 1). Sin `@Roles`: `JwtAuthGuard`/`RolesGuard`
 * globales (D-011) ya exigen estar autenticado; cualquier `user`/`admin`
 * entra al módulo tal cual.
 */
@Controller('focus-flow')
export class FocusFlowController {
  constructor(
    private readonly settingsService: FocusSettingsService,
    private readonly tasksService: FocusTasksService,
    private readonly sessionsService: FocusSessionsService,
    private readonly statsService: FocusStatsService
  ) {}

  @Get('settings')
  getSettings(@CurrentUser() user: AuthUser): Promise<FocusSettings> {
    return this.settingsService.getOrCreate(user);
  }

  @Put('settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateFocusSettingsRequestSchema)) body: UpdateFocusSettingsRequest
  ): Promise<FocusSettings> {
    return this.settingsService.update(user, body);
  }

  @Get('tasks')
  listTasks(@CurrentUser() user: AuthUser, @Query('date') date?: string): Promise<FocusTask[]> {
    return this.tasksService.listForDate(user, date);
  }

  @Post('tasks')
  createTask(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createFocusTaskRequestSchema)) body: CreateFocusTaskRequest
  ): Promise<FocusTask> {
    return this.tasksService.createTask(user, body);
  }

  /** "Importar mis tareas asignadas" (gate funcional, decisión 2). */
  @Post('tasks/import-from-proyectos')
  importTasksFromProyectos(@CurrentUser() user: AuthUser): Promise<ImportFocusTasksResponse> {
    return this.tasksService.importFromProyectos(user);
  }

  @Patch('tasks/:id')
  updateTask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFocusTaskRequestSchema)) body: UpdateFocusTaskRequest
  ): Promise<FocusTask> {
    return this.tasksService.updateTask(user, id, body);
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  async deleteTask(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.tasksService.deleteTask(user, id);
  }

  @Post('sessions')
  createSession(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createFocusSessionRequestSchema)) body: CreateFocusSessionRequest
  ): Promise<FocusSession> {
    return this.sessionsService.create(user, body);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser): Promise<FocusDashboard> {
    return this.statsService.dashboard(user);
  }

  @Get('performance')
  performance(@CurrentUser() user: AuthUser, @Query('range') range?: string): Promise<FocusPerformance> {
    const parsed = focusPerformanceRangeSchema.safeParse(range);
    return this.statsService.performance(user, parsed.success ? parsed.data : DEFAULT_PERFORMANCE_RANGE);
  }
}
