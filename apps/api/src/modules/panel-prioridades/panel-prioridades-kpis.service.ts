import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '@awk/auth';
import type { PanelKpisResponse, Diagnostic, QuadrantDistribution } from './panel-prioridades.types';
import { PanelPrioritiesScheduleService } from './panel-prioridades-schedule.service';

/**
 * Servicio de cálculo de KPIs e indicadores del panel.
 * Genera métricas sobre carga, distribución y diagnósticos automáticos.
 */
@Injectable()
export class PanelPrioritiesKpisService {
  constructor(
    private prisma: PrismaService,
    private scheduleService: PanelPrioritiesScheduleService
  ) {}

  /**
   * Calcula todos los KPIs del usuario.
   */
  async getKpis(user: AuthUser): Promise<PanelKpisResponse> {
    const openTasks = await this.prisma.panelTask.findMany({
      where: { userId: user.id, status: 'open' }
    });

    const overdueCount = openTasks.filter(t => {
      if (!t.dueDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return t.dueDate < today;
    }).length;

    // Tareas por cuadrante
    const tasksByQuadrant: QuadrantDistribution[] = [];
    for (let q = 1; q <= 4; q++) {
      const count = openTasks.filter(t => t.quadrant === q).length;
      tasksByQuadrant.push({
        quadrant: q,
        taskCount: count,
        totalMinutes: openTasks.filter(t => t.quadrant === q).reduce((sum, t) => sum + t.estimatedMinutes, 0)
      });
    }

    // Minutos reservados por cuadrante
    const minutesByQuadrant = await this.scheduleService.getMinutesByQuadrant(user);
    const minutesByQuadrantArray: QuadrantDistribution[] = [];
    for (let q = 1; q <= 4; q++) {
      minutesByQuadrantArray.push({
        quadrant: q,
        taskCount: tasksByQuadrant[q - 1].taskCount,
        totalMinutes: minutesByQuadrant.get(q) || 0
      });
    }

    // Total minutos reservados en la semana
    const weekTotalMinutes = await this.scheduleService.getWeekTotalMinutes(user);

    // Porcentaje en cuadrante 2
    const q2Minutes = minutesByQuadrant.get(2) || 0;
    const q2Percentage = weekTotalMinutes > 0 ? Math.round((q2Minutes / weekTotalMinutes) * 100) : 0;

    // Diagnósticos automáticos
    const diagnostics = this.generateDiagnostics(weekTotalMinutes, q2Minutes, openTasks);

    return {
      openTasksCount: openTasks.length,
      weekScheduledMinutes: weekTotalMinutes,
      q2PercentageMinutes: q2Percentage,
      overdueTasksCount: overdueCount,
      tasksByQuadrant,
      minutesByQuadrant: minutesByQuadrantArray,
      diagnostics
    };
  }

  /**
   * Genera diagnósticos automáticos basados en la distribución de tiempo.
   */
  private generateDiagnostics(weekTotalMinutes: number, q2Minutes: number, tasks: any[]): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    if (weekTotalMinutes === 0) {
      // No hay bloques agendados
      diagnostics.push({
        type: 'falta_fondo',
        message: 'No tienes ningún bloque agendado esta semana. Comienza por reservar tiempo para el cuadrante 2 (importante-no-urgente).'
      });
      return diagnostics;
    }

    const q1Minutes = this.getMinutesByQuadrant(tasks, 1);
    const q2Percentage = (q2Minutes / weekTotalMinutes) * 100;
    const q1Percentage = (q1Minutes / weekTotalMinutes) * 100;

    // Diagnóstico: Modo apagafuegos
    if (q1Percentage > 40) {
      diagnostics.push({
        type: 'apagafuegos',
        message: `Modo apagafuegos: ${Math.round(q1Percentage)}% de tu semana está en tareas urgentes-importantes. Lo urgente-importante suele ser el Q2 que no planificaste hace tres semanas.`
      });
    }

    // Diagnóstico: Semana bien orientada
    if (q2Percentage >= 50) {
      diagnostics.push({
        type: 'bien_orientada',
        message: `Semana bien orientada: ${Math.round(q2Percentage)}% del tiempo reservado va a trabajo importante y no urgente — eso reduce las urgencias del mes que viene.`
      });
    }

    // Diagnóstico: Falta fondo
    if (q2Percentage < 50) {
      const target = Math.ceil((weekTotalMinutes * 0.5 - q2Minutes) / 60); // horas recomendadas
      diagnostics.push({
        type: 'falta_fondo',
        message: `Falta fondo: solo el ${Math.round(q2Percentage)}% de tu semana está reservado para Q2. Bloquea al menos ${target} h más.`
      });
    }

    // Diagnóstico: Urgencias sin responsable
    const delegationsWithoutAssignee = tasks.filter(t => t.quadrant === 3 && !t.delegation?.delegatedToName).length;
    if (delegationsWithoutAssignee > 0) {
      diagnostics.push({
        type: 'urgencias_sin_responsable',
        message: `${delegationsWithoutAssignee} urgencia(s) sin responsable. Están ocupando tu cabeza sin estar en la de nadie más.`
      });
    }

    return diagnostics;
  }

  /**
   * Calcula minutos totales para un cuadrante (desde tareas abiertas).
   */
  private getMinutesByQuadrant(tasks: any[], quadrant: number): number {
    return tasks.filter(t => t.quadrant === quadrant).reduce((sum, t) => sum + t.estimatedMinutes, 0);
  }
}
