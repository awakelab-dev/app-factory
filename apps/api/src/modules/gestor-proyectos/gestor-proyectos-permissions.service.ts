import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { PrismaService } from '../../prisma/prisma.service';

/** Forma mínima de una tarea que necesitan las reglas de permiso de abajo. */
export interface PermissionTaskSubject {
  assigneeId: string;
  createdById: string;
}

/**
 * Reglas de permiso por fila (no por rol) del hallazgo de seguridad más
 * importante del prototipo (spec-tecnica.md "Lógica de permisos"): el
 * prototipo las calculaba SOLO en el cliente para decidir qué botón
 * mostrar — nada impedía llamar a la función subyacente directamente desde
 * la consola del navegador. Aquí se reevalúan en el backend, en el servicio,
 * para cada endpoint de tarea/subtarea/comentario — nunca basta con el
 * `RolesGuard` (ese es de rol; estas son de fila: ¿soy YO el asignado/creador
 * de ESTA tarea?). Centralizadas en un solo lugar (mismo espíritu que
 * `AuditService`/`RolesGuard`) para que ningún controlador reimplemente la
 * regla distinto.
 */
@Injectable()
export class GestorPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: AuthUser): boolean {
    return user.roles.includes('admin');
  }

  /** Admin siempre; si no, existe alguna tarea del proyecto asignada a `user`. */
  async participatesIn(user: AuthUser, projectId: string): Promise<boolean> {
    if (this.isAdmin(user)) return true;
    const own = await this.prisma.task.findFirst({
      where: { projectId, assigneeId: user.id },
      select: { id: true }
    });
    return own !== null;
  }

  /** Admin, o la persona asignada a la tarea. */
  canChangeStatus(user: AuthUser, task: PermissionTaskSubject): boolean {
    return this.isAdmin(user) || task.assigneeId === user.id;
  }

  /** Subtareas y comentarios: misma regla que cambiar de estado. */
  canAddInfo(user: AuthUser, task: PermissionTaskSubject): boolean {
    return this.canChangeStatus(user, task);
  }

  /** Admin, o quien creó la tarea Y sigue asignada a sí mismo. */
  canEditTask(user: AuthUser, task: PermissionTaskSubject): boolean {
    return this.isAdmin(user) || (task.createdById === user.id && task.assigneeId === user.id);
  }

  /** Misma regla que editar. */
  canDeleteTask(user: AuthUser, task: PermissionTaskSubject): boolean {
    return this.canEditTask(user, task);
  }

  /** Snapshot de las 4 reglas para una tarea — lo que viaja en la respuesta al frontend. */
  taskPermissions(user: AuthUser, task: PermissionTaskSubject) {
    return {
      canChangeStatus: this.canChangeStatus(user, task),
      canAddInfo: this.canAddInfo(user, task),
      canEditTask: this.canEditTask(user, task),
      canDeleteTask: this.canDeleteTask(user, task)
    };
  }
}
