import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Roles } from '../../core/auth/auth.decorators';
import { GestorProjectsService } from './gestor-proyectos-projects.service';
import { GestorTasksService } from './gestor-proyectos-tasks.service';
import { GestorReportsService } from './gestor-proyectos-reports.service';
import {
  createGestorCommentRequestSchema,
  createGestorProjectRequestSchema,
  createGestorSubtaskRequestSchema,
  createGestorTaskRequestSchema,
  updateGestorSubtaskRequestSchema,
  updateGestorTaskRequestSchema,
  updateGestorTaskStatusRequestSchema,
  type CreateGestorCommentRequest,
  type CreateGestorProjectRequest,
  type CreateGestorSubtaskRequest,
  type CreateGestorTaskRequest,
  type GestorComment,
  type GestorDashboard,
  type GestorProjectDetail,
  type GestorProjectSummary,
  type GestorReport,
  type GestorSprint,
  type GestorSubtask,
  type GestorTaskRow,
  type UpdateGestorSubtaskRequest,
  type UpdateGestorTaskRequest,
  type UpdateGestorTaskStatusRequest
} from './gestor-proyectos.types';

/**
 * Tablero kanban de proyectos/sprints/tareas de uso interno (D-011: sin rol
 * de manifest nuevo, reutiliza `admin`/`user` de core — ver
 * `apps/web/.../gestor-proyectos/module.manifest.ts`, que sí declara nav/
 * roles del shell). Cualquier autenticado entra al módulo; las rutas de
 * escritura administrativa (`@Roles('admin')`) son proyectos/sprints. Las
 * reglas finas por tarea (¿soy el asignado/creador de ESTA tarea?) NO viven
 * en `@Roles` — se revalidan en `GestorPermissionsService` dentro de cada
 * servicio, porque son de fila, no de rol (spec-tecnica.md "Lógica de
 * permisos": el hallazgo de seguridad más importante del prototipo era
 * confiar esa regla solo al cliente).
 */
@Controller('gestor-proyectos')
export class GestorProyectosController {
  constructor(
    private readonly projectsService: GestorProjectsService,
    private readonly tasksService: GestorTasksService,
    private readonly reportsService: GestorReportsService
  ) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser): Promise<GestorDashboard> {
    return this.tasksService.dashboard(user);
  }

  @Get('projects')
  listProjects(@CurrentUser() user: AuthUser): Promise<GestorProjectSummary[]> {
    return this.projectsService.listForUser(user);
  }

  @Roles('admin')
  @Post('projects')
  createProject(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createGestorProjectRequestSchema)) body: CreateGestorProjectRequest
  ): Promise<GestorProjectDetail> {
    return this.projectsService.createProject(user, body);
  }

  @Roles('admin')
  @Delete('projects/:id')
  @HttpCode(204)
  async deleteProject(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.projectsService.deleteProject(user, id);
  }

  @Get('projects/:id')
  getProject(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<GestorProjectDetail> {
    return this.projectsService.getDetail(user, id);
  }

  @Roles('admin')
  @Post('projects/:id/sprints')
  createSprint(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<GestorSprint> {
    return this.projectsService.createNextSprint(user, id);
  }

  @Get('sprints/:id/tasks')
  sprintTasks(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<GestorTaskRow[]> {
    return this.tasksService.sprintKanban(user, id);
  }

  @Post('tasks')
  createTask(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createGestorTaskRequestSchema)) body: CreateGestorTaskRequest
  ): Promise<GestorTaskRow> {
    return this.tasksService.createTask(user, body);
  }

  @Patch('tasks/:id/status')
  updateTaskStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGestorTaskStatusRequestSchema)) body: UpdateGestorTaskStatusRequest
  ): Promise<GestorTaskRow> {
    return this.tasksService.updateStatus(user, id, body);
  }

  @Patch('tasks/:id')
  updateTask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGestorTaskRequestSchema)) body: UpdateGestorTaskRequest
  ): Promise<GestorTaskRow> {
    return this.tasksService.updateTask(user, id, body);
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  async deleteTask(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.tasksService.deleteTask(user, id);
  }

  @Post('tasks/:id/subtasks')
  addSubtask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createGestorSubtaskRequestSchema)) body: CreateGestorSubtaskRequest
  ): Promise<GestorSubtask> {
    return this.tasksService.addSubtask(user, id, body);
  }

  @Patch('subtasks/:id')
  updateSubtask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGestorSubtaskRequestSchema)) body: UpdateGestorSubtaskRequest
  ): Promise<GestorSubtask> {
    return this.tasksService.toggleSubtask(user, id, body.done);
  }

  @Post('tasks/:id/comments')
  addComment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createGestorCommentRequestSchema)) body: CreateGestorCommentRequest
  ): Promise<GestorComment> {
    return this.tasksService.addComment(user, id, body);
  }

  @Get('reports')
  report(
    @CurrentUser() user: AuthUser,
    @Query('projectId') projectId?: string,
    @Query('sprintId') sprintId?: string
  ): Promise<GestorReport> {
    if (!projectId || !sprintId) {
      throw new BadRequestException('projectId y sprintId son parámetros de query obligatorios');
    }
    return this.reportsService.report(user, projectId, sprintId);
  }
}
