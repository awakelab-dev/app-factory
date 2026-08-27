import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException
} from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import type {
  Task,
  TaskWithOverdue,
  CreateTaskRequest,
  UpdateTaskRequest,
  ScheduleGrid,
  ScheduleBlockRequest,
  TeamMember,
  CreateTeamMemberRequest,
  UpdateTeamMemberRequest,
  UpdateDelegationRequest,
  KPIs
} from './panel-prioridades.types';

/**
 * Panel de Prioridades: lógica de negocio basada en la matriz de Eisenhower.
 * - Gestión de tareas por cuadrante (urgencia × importancia)
 * - Bloque de tiempo semanal (lunes-viernes, 8-17)
 * - Delegaciones (cuadrante 3: urgente no importante)
 * - Indicadores (KPIs) con diagnósticos automáticos
 * - Auditoría de cambios
 *
 * Patrón: todas las operaciones filtran por `userId` (monouser hoy,
 * multi-usuario en futuro). RLS de Postgres redundante con RBAC de aplicación.
 */
@Injectable()
export class PanelPrioridadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Calcular cuadrante y acción a partir de urgencia/importancia.
   * Q1 (do): urgent + important
   * Q2 (plan): not urgent + important
   * Q3 (delegate): urgent + not important
   * Q4 (eliminate): not urgent + not important
   */
  private calculateQuadrantAndAction(urgent: boolean, important: boolean) {
    let quadrant: number;
    let action: 'do' | 'plan' | 'delegate' | 'eliminate';

    if (urgent && important) {
      quadrant = 1;
      action = 'do';
    } else if (!urgent && important) {
      quadrant = 2;
      action = 'plan';
    } else if (urgent && !important) {
      quadrant = 3;
      action = 'delegate';
    } else {
      quadrant = 4;
      action = 'eliminate';
    }

    return { quadrant, action };
  }

  /**
   * Añadir flag `overdue` a una tarea (dueDate pasada).
   */
  private addOverdueFlag(task: Task): TaskWithOverdue {
    const overdue =
      task.dueDate && new Date(task.dueDate) < new Date() && task.status === 'open';
    return { ...task, overdue: Boolean(overdue) };
  }

  /**
   * Verificar autorización (usuario solo ve/edita sus propias tareas).
   */
  private ensureAuthorization(userId: string, user: AuthUser) {
    if (userId !== user.id) {
      throw new ForbiddenException('No tienes permiso para acceder a esta tarea');
    }
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  /**
   * GET /api/panel-prioridades/tasks
   * Lista tareas abiertas del usuario con filtros opcionales.
   */
  async listTasks(
    user: AuthUser,
    filters?: {
      quadrant?: number;
      status?: 'open' | 'done' | 'discarded';
      origin?: string;
    }
  ): Promise<{ tasks: TaskWithOverdue[]; total: number }> {
    const tasks = await this.prisma.panelTask.findMany({
      where: {
        userId: user.id,
        quadrant: filters?.quadrant,
        status: filters?.status,
        origin: filters?.origin
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    const tasksWithOverdue = tasks.map(t => this.addOverdueFlag(t as Task));
    return { tasks: tasksWithOverdue, total: tasks.length };
  }

  /**
   * POST /api/panel-prioridades/tasks
   * Crear nueva tarea. Calcula automáticamente cuadrante y acción.
   */
  async createTask(user: AuthUser, body: CreateTaskRequest): Promise<Task> {
    const { quadrant, action } = this.calculateQuadrantAndAction(
      body.urgent,
      body.important
    );

    const task = await this.prisma.panelTask.create({
      data: {
        userId: user.id,
        title: body.title,
        detail: body.detail || null,
        urgent: body.urgent,
        important: body.important,
        quadrant,
        action,
        dueDate: body.dueDate || null,
        estimatedMinutes: body.estimatedMinutes,
        origin: body.origin,
        status: 'open'
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'panel_prioridades.task_created',
      entity: 'task',
      entityId: task.id,
      metadata: { title: task.title, quadrant, action }
    });

    return task as Task;
  }

  /**
   * PUT /api/panel-prioridades/tasks/:id
   * Actualizar tarea. Si urgent/important cambian, recalcula cuadrante y acción.
   * Si pasa a Q4: elimina todos los bloques agendados.
   * Si sale de Q3: limpia delegación.
   */
  async updateTask(user: AuthUser, id: string, body: UpdateTaskRequest): Promise<Task> {
    const task = await this.prisma.panelTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    this.ensureAuthorization(task.userId, user);

    let quadrant = task.quadrant;
    let action = task.action;

    if (body.urgent !== undefined || body.important !== undefined) {
      const urgent = body.urgent !== undefined ? body.urgent : task.urgent;
      const important = body.important !== undefined ? body.important : task.important;
      ({ quadrant, action } = this.calculateQuadrantAndAction(urgent, important));
    }

    // Si pasa a Q4 (eliminate): elimina bloques agendados
    if (quadrant === 4 && task.quadrant !== 4) {
      await this.prisma.scheduleBlock.deleteMany({
        where: { taskId: id }
      });
    }

    // Si sale de Q3 (delegate): limpia delegación
    if (task.quadrant === 3 && quadrant !== 3) {
      await this.prisma.delegation.deleteMany({
        where: { taskId: id }
      });
    }

    const updated = await this.prisma.panelTask.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title : task.title,
        detail: body.detail !== undefined ? body.detail : task.detail,
        urgent: body.urgent !== undefined ? body.urgent : task.urgent,
        important: body.important !== undefined ? body.important : task.important,
        quadrant,
        action,
        dueDate: body.dueDate !== undefined ? body.dueDate : task.dueDate,
        estimatedMinutes:
          body.estimatedMinutes !== undefined ? body.estimatedMinutes : task.estimatedMinutes,
        origin: body.origin !== undefined ? body.origin : task.origin,
        status: body.status !== undefined ? body.status : task.status
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'panel_prioridades.task_updated',
      entity: 'task',
      entityId: id,
      metadata: { previousQuadrant: task.quadrant, newQuadrant: quadrant }
    });

    return updated as Task;
  }

  /**
   * GET /api/panel-prioridades/tasks/:id/history
   * Historial de cambios de una tarea.
   */
  async getTaskHistory(user: AuthUser, id: string) {
    const task = await this.prisma.panelTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    this.ensureAuthorization(task.userId, user);

    const history = await this.prisma.panelAuditTrail.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' }
    });

    return { history };
  }

  /**
   * DELETE /api/panel-prioridades/tasks/:id
   * Marca como descartada (soft delete). Automáticamente libera bloques agendados.
   */
  async deleteTask(user: AuthUser, id: string): Promise<void> {
    const task = await this.prisma.panelTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    this.ensureAuthorization(task.userId, user);

    // Libera bloques agendados
    await this.prisma.scheduleBlock.deleteMany({
      where: { taskId: id }
    });

    // Marca como descartada
    await this.prisma.panelTask.update({
      where: { id },
      data: { status: 'discarded' }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'panel_prioridades.task_discarded',
      entity: 'task',
      entityId: id
    });
  }

  // ---------------------------------------------------------------------------
  // Schedule (Time-blocking)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/panel-prioridades/schedule
   * Matriz semanal (lunes-viernes, 8-17) con tareas agendadas.
   */
  async getScheduleGrid(user: AuthUser): Promise<ScheduleGrid> {
    const blocks = await this.prisma.scheduleBlock.findMany({
      where: { userId: user.id },
      include: {
        task: {
          select: { id: true, title: true, quadrant: true }
        }
      }
    });

    const gridData = blocks.map(b => ({
      dayOfWeek: b.dayOfWeek,
      hour: b.hour,
      taskId: b.taskId,
      taskTitle: b.task?.title || null
    }));

    return { blocks: gridData };
  }

  /**
   * POST /api/panel-prioridades/schedule/:taskId/:day/:hour
   * Reserva un bloque (o libera si ya existe). Rechaza cuadrante 4.
   */
  async toggleScheduleBlock(
    user: AuthUser,
    taskId: string,
    day: number,
    hour: number,
    body?: ScheduleBlockRequest
  ): Promise<void> {
    if (day < 0 || day > 4) throw new BadRequestException('Día inválido (0-4)');
    if (hour < 8 || hour > 17) throw new BadRequestException('Hora inválida (8-17)');

    const task = await this.prisma.panelTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    this.ensureAuthorization(task.userId, user);

    // Rechaza cuadrante 4
    if (task.quadrant === 4) {
      throw new BadRequestException(
        'No se puede agendar una tarea del cuadrante 4 (Eliminar)'
      );
    }

    // Busca bloque existente
    const existing = await this.prisma.scheduleBlock.findFirst({
      where: {
        userId: user.id,
        dayOfWeek: day,
        hour
      }
    });

    if (existing) {
      // Si el bloque ya existe y taskId es null en body: libera
      if (body?.taskId === null || body?.taskId === undefined) {
        await this.prisma.scheduleBlock.delete({ where: { id: existing.id } });
      } else {
        // Si ya hay tarea distinta: conflicto
        if (existing.taskId && existing.taskId !== taskId) {
          throw new ConflictException(
            'Otro bloque ya ocupa esa franja. Libéralo primero.'
          );
        }
      }
    } else {
      // Crear nuevo bloque
      await this.prisma.scheduleBlock.create({
        data: {
          userId: user.id,
          taskId,
          dayOfWeek: day,
          hour
        }
      });
    }

    await this.audit.log({
      actorId: user.id,
      action: 'panel_prioridades.schedule_toggled',
      entity: 'schedule_block',
      metadata: { taskId, day, hour }
    });
  }

  // ---------------------------------------------------------------------------
  // Team (Delegation management)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/panel-prioridades/team
   * Lista del equipo del usuario.
   */
  async getTeam(user: AuthUser) {
    const team = await this.prisma.teamMember.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' }
    });

    return { team };
  }

  /**
   * POST /api/panel-prioridades/team
   * Añade persona al equipo.
   */
  async addTeamMember(user: AuthUser, body: CreateTeamMemberRequest): Promise<TeamMember> {
    const member = await this.prisma.teamMember.create({
      data: {
        userId: user.id,
        addedByUserId: user.id,
        name: body.name,
        email: body.email,
        active: true
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'panel_prioridades.team_member_added',
      entity: 'team_member',
      entityId: member.id,
      metadata: { name: member.name, email: member.email }
    });

    return member as TeamMember;
  }

  /**
   * PUT /api/panel-prioridades/team/:id
   * Edita nombre/email de equipo.
   */
  async updateTeamMember(
    user: AuthUser,
    id: string,
    body: UpdateTeamMemberRequest
  ): Promise<TeamMember> {
    const member = await this.prisma.teamMember.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Miembro del equipo no encontrado');
    this.ensureAuthorization(member.userId, user);

    const updated = await this.prisma.teamMember.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name : member.name,
        email: body.email !== undefined ? body.email : member.email,
        active: body.active !== undefined ? body.active : member.active
      }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'panel_prioridades.team_member_updated',
      entity: 'team_member',
      entityId: id
    });

    return updated as TeamMember;
  }

  /**
   * DELETE /api/panel-prioridades/team/:id
   * Desactiva persona (soft delete).
   */
  async deleteTeamMember(user: AuthUser, id: string): Promise<void> {
    const member = await this.prisma.teamMember.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Miembro del equipo no encontrado');
    this.ensureAuthorization(member.userId, user);

    await this.prisma.teamMember.update({
      where: { id },
      data: { active: false }
    });

    await this.audit.log({
      actorId: user.id,
      action: 'panel_prioridades.team_member_deleted',
      entity: 'team_member',
      entityId: id
    });
  }

  // ---------------------------------------------------------------------------
  // Delegations
  // ---------------------------------------------------------------------------

  /**
   * PUT /api/panel-prioridades/tasks/:id/delegate
   * Establece/cambia delegación de una tarea Q3 (urgente no importante).
   */
  async setDelegation(
    user: AuthUser,
    taskId: string,
    body: UpdateDelegationRequest
  ): Promise<void> {
    const task = await this.prisma.panelTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    this.ensureAuthorization(task.userId, user);

    if (task.quadrant !== 3) {
      throw new BadRequestException(
        'Solo se pueden delegar tareas del cuadrante 3 (Delegar)'
      );
    }

    const existing = await this.prisma.delegation.findFirst({
      where: { taskId }
    });

    if (existing) {
      await this.prisma.delegation.update({
        where: { id: existing.id },
        data: {
          delegatedToName: body.delegatedToName || null,
          followUpDate: body.followUpDate || null
        }
      });
    } else {
      await this.prisma.delegation.create({
        data: {
          taskId,
          userId: user.id,
          delegatedToName: body.delegatedToName || null,
          followUpDate: body.followUpDate || null
        }
      });
    }

    await this.audit.log({
      actorId: user.id,
      action: 'panel_prioridades.delegation_set',
      entity: 'delegation',
      metadata: { taskId, delegatedTo: body.delegatedToName }
    });
  }

  // ---------------------------------------------------------------------------
  // KPIs & Diagnostics
  // ---------------------------------------------------------------------------

  /**
   * GET /api/panel-prioridades/kpis
   * Indicadores: recuento por cuadrante, horas reservadas, % Q2, vencidas, etc.
   * Diagnósticos automáticos: modo apagafuegos, semana bien orientada, etc.
   */
  async getKPIs(user: AuthUser): Promise<KPIs> {
    const openTasks = await this.prisma.panelTask.findMany({
      where: { userId: user.id, status: 'open' }
    });

    const blocks = await this.prisma.scheduleBlock.findMany({
      where: { userId: user.id }
    });

    // Contar por cuadrante
    const tasksByQuadrant = {
      q1: openTasks.filter(t => t.quadrant === 1).length,
      q2: openTasks.filter(t => t.quadrant === 2).length,
      q3: openTasks.filter(t => t.quadrant === 3).length,
      q4: openTasks.filter(t => t.quadrant === 4).length
    };

    // Horas por cuadrante (desde bloques)
    const hoursByQuadrant = { q1: 0, q2: 0, q3: 0, q4: 0 };
    blocks.forEach(b => {
      const task = openTasks.find(t => t.id === b.taskId);
      if (task) {
        const q = `q${task.quadrant}` as 'q1' | 'q2' | 'q3' | 'q4';
        hoursByQuadrant[q] += 1; // 1 hora por bloque
      }
    });

    const totalHoursScheduled = Object.values(hoursByQuadrant).reduce((a, b) => a + b, 0);
    const percentageQ2 = totalHoursScheduled > 0
      ? Math.round((hoursByQuadrant.q2 / totalHoursScheduled) * 100)
      : 0;

    // Tareas vencidas
    const overdueCount = openTasks.filter(
      t => t.dueDate && new Date(t.dueDate) < new Date()
    ).length;

    // Delegaciones sin responsable (Q3 sin delegado)
    const delegationsWithoutResponsible = (
      await this.prisma.delegation.findMany({
        where: {
          userId: user.id,
          delegatedToName: null
        }
      })
    ).length;

    // Diagnósticos automáticos
    const diagnostics = [];

    if (totalHoursScheduled > 0) {
      if (percentageQ2 < 50 && hoursByQuadrant.q1 > 0) {
        diagnostics.push({
          key: 'fire_fighting_mode',
          message:
            'Modo apagafuegos: el ' +
            Math.round((hoursByQuadrant.q1 / totalHoursScheduled) * 100) +
            '% del tiempo reservado va a lo urgente e importante. ' +
            'Bloquea más tiempo para el Q2 (importante pero no urgente).',
          severity: 'warning' as const
        });
      }

      if (percentageQ2 >= 50) {
        diagnostics.push({
          key: 'well_oriented_week',
          message:
            'Semana bien orientada: el ' + percentageQ2 + '% del tiempo reservado va al Q2 (fondo importante). ' +
            'Esto reduce las urgencias del mes que viene.',
          severity: 'info' as const
        });
      }

      if (percentageQ2 < 50 && hoursByQuadrant.q1 === 0) {
        diagnostics.push({
          key: 'lack_of_foundation',
          message:
            'Falta fondo: solo el ' +
            percentageQ2 +
            '% de tu semana está reservado para trabajo importante pero no urgente. ' +
            'Bloquea al menos 20 h más.',
          severity: 'warning' as const
        });
      }
    }

    if (delegationsWithoutResponsible > 0) {
      diagnostics.push({
        key: 'delegations_without_responsible',
        message:
          delegationsWithoutResponsible +
          ' urgencia(s) sin responsable. Están ocupando tu cabeza sin estar en la de nadie más.',
        severity: 'critical' as const
      });
    }

    return {
      totalOpen: openTasks.length,
      totalHoursScheduled,
      percentageQ2,
      overdueCount,
      delegationsWithoutResponsible,
      tasksByQuadrant,
      hoursByQuadrant,
      diagnostics
    };
  }
}
