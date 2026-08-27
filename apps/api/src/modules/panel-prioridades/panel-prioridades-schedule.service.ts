import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '@awk/auth';
import type { ScheduleWeek, ScheduleGrid } from './panel-prioridades.types';

/**
 * Servicio de gestión de bloques de agenda semanal (lunes–viernes, 8–17).
 * Una franja horaria solo puede tener una tarea (unique constraint).
 */
@Injectable()
export class PanelPrioritiesScheduleService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene la semana completa (matriz de día×hora) para el usuario.
   * Devuelve todos los slots lunes–viernes 8–17 con tarea_id si ocupado.
   */
  async getWeekSchedule(user: AuthUser): Promise<ScheduleWeek> {
    const blocks = await this.prisma.panelScheduleBlock.findMany({
      where: { userId: user.id },
      include: { task: true }
    });

    const schedule: ScheduleWeek = [];

    for (let day = 0; day < 5; day++) {
      const dayBlocks: ScheduleGrid[] = [];
      for (let hour = 8; hour <= 17; hour++) {
        const block = blocks.find(b => b.dayOfWeek === day && b.hour === hour);
        dayBlocks.push({
          day,
          hour,
          taskId: block?.taskId || null,
          taskTitle: block?.task?.title || null
        });
      }
      schedule.push({
        day,
        blocks: dayBlocks
      });
    }

    return schedule;
  }

  /**
   * Reserva (o libera) un bloque horario para una tarea.
   * Si el slot ya está ocupado, lanza error.
   * Si se intenta agendar cuadrante 4, rechaza.
   * Si day/hour ya existen para este usuario, primero se liberan.
   */
  async reserveBlock(
    user: AuthUser,
    taskId: string,
    dayOfWeek: number,
    hour: number
  ): Promise<void> {
    // Validar rango
    if (dayOfWeek < 0 || dayOfWeek > 4) {
      throw new BadRequestException('Día inválido (0–4: lunes–viernes)');
    }
    if (hour < 8 || hour > 17) {
      throw new BadRequestException('Hora inválida (8–17)');
    }

    // Obtener la tarea para verificar cuadrante
    const task = await this.prisma.panelTask.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (task.userId !== user.id) {
      throw new BadRequestException('No tienes permiso para agendar esta tarea');
    }

    // Rechazar si cuadrante 4 (eliminate)
    if (task.quadrant === 4) {
      throw new BadRequestException('El cuadrante 4 (Eliminar) no se puede agendar');
    }

    // Verificar que no haya otro bloque en ese slot
    const existing = await this.prisma.panelScheduleBlock.findUnique({
      where: {
        userId_dayOfWeek_hour: {
          userId: user.id,
          dayOfWeek,
          hour
        }
      }
    });

    if (existing && existing.taskId !== taskId) {
      throw new BadRequestException('Este slot ya está ocupado por otra tarea');
    }

    // Si no existe, crear; si existe para la misma tarea, no hacer nada (idempotente)
    if (!existing) {
      await this.prisma.panelScheduleBlock.create({
        data: {
          userId: user.id,
          taskId,
          dayOfWeek,
          hour
        }
      });
    }
  }

  /**
   * Libera un bloque horario (lo borra, no asigna a null).
   */
  async releaseBlock(
    user: AuthUser,
    dayOfWeek: number,
    hour: number
  ): Promise<void> {
    // Validar rango
    if (dayOfWeek < 0 || dayOfWeek > 4) {
      throw new BadRequestException('Día inválido (0–4)');
    }
    if (hour < 8 || hour > 17) {
      throw new BadRequestException('Hora inválida (8–17)');
    }

    await this.prisma.panelScheduleBlock.deleteMany({
      where: {
        userId: user.id,
        dayOfWeek,
        hour
      }
    });
  }

  /**
   * Obtiene el total de minutos reservados en la semana (para KPIs).
   */
  async getWeekTotalMinutes(user: AuthUser): Promise<number> {
    const blocks = await this.prisma.panelScheduleBlock.findMany({
      where: { userId: user.id },
      include: { task: true }
    });

    return blocks.reduce((sum, b) => sum + (b.task?.estimatedMinutes || 60), 0);
  }

  /**
   * Obtiene los minutos reservados por cuadrante en la semana (para KPIs).
   */
  async getMinutesByQuadrant(user: AuthUser): Promise<Map<number, number>> {
    const blocks = await this.prisma.panelScheduleBlock.findMany({
      where: { userId: user.id },
      include: { task: true }
    });

    const byQuadrant = new Map<number, number>();
    for (let q = 1; q <= 4; q++) {
      byQuadrant.set(q, 0);
    }

    for (const block of blocks) {
      if (block.task) {
        const current = byQuadrant.get(block.task.quadrant) || 0;
        byQuadrant.set(block.task.quadrant, current + block.task.estimatedMinutes);
      }
    }

    return byQuadrant;
  }
}
