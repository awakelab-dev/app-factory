import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { toSessionDto } from './focus-flow.mappers';
import type { CreateFocusSessionRequest, FocusSession } from './focus-flow.types';

/**
 * Único punto de contacto del timer con el backend (spec-tecnica.md
 * "Temporizador — qué vive en el cliente vs. qué se persiste"): el cliente
 * sigue siendo la autoridad del conteo en curso; esto solo persiste el
 * resultado de una fase YA terminada (completada o saltada).
 */
@Injectable()
export class FocusSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, dto: CreateFocusSessionRequest): Promise<FocusSession> {
    const task = dto.taskId ? await this.requireOwnTask(user, dto.taskId) : null;

    // Saltar una fase de enfoque NUNCA cuenta como pomodoro completado (ver
    // definición de "foco efectivo" del gate técnico: completadas /
    // (completadas + saltadas) — si contara, "saltar" nunca bajaría la
    // proporción). Tope en el estimado de la tarea, igual que el prototipo
    // (`Math.min(total, pom+1)` en `phaseComplete()`).
    const shouldCreditPomodoro = dto.phase === 'focus' && !dto.wasSkipped && task !== null;

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.focusSession.create({
        data: {
          userId: user.id,
          taskId: dto.taskId ?? null,
          phase: dto.phase,
          startedAt: new Date(dto.startedAt),
          completedAt: new Date(dto.completedAt),
          durationSeconds: dto.durationSeconds,
          wasSkipped: dto.wasSkipped
        }
      });

      if (shouldCreditPomodoro && task) {
        await tx.focusTask.update({
          where: { id: task.id },
          data: { completedPomodoros: Math.min(task.estimatedPomodoros, task.completedPomodoros + 1) }
        });
      }

      return created;
    });

    return toSessionDto(row);
  }

  private async requireOwnTask(
    user: AuthUser,
    taskId: string
  ): Promise<{ id: string; estimatedPomodoros: number; completedPomodoros: number }> {
    const task = await this.prisma.focusTask.findUnique({ where: { id: taskId } });
    if (!task || task.userId !== user.id) throw new NotFoundException(`No existe la tarea "${taskId}"`);
    return task;
  }
}
