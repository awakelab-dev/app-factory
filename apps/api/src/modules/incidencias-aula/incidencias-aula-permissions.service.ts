import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';

/** Forma mínima de una incidencia que necesita la regla de visibilidad de detalle. */
export interface PermissionIncidenciaSubject {
  docenteId: string;
}

/**
 * Reglas de permiso por FILA (no solo por rol) — mismo espíritu que
 * `GestorPermissionsService` de `gestor-proyectos` (spec-tecnica.md
 * `incidencias-aula`, "Reglas de permiso por fila"): el `RolesGuard` decide
 * si el rol puede llegar al endpoint; este servicio decide si ESTA fila es
 * visible/accionable para ESTE usuario. Un docente solo ve el detalle de sus
 * propias incidencias; coordinación (y admin) ven/accionan cualquiera. Nunca
 * se confía solo en el rol para ocultar/mostrar botones en el cliente.
 */
@Injectable()
export class IncidenciasPermissionsService {
  isAdmin(user: AuthUser): boolean {
    return user.roles.includes('admin');
  }

  /** Admin o `incidencias_coordinacion`: la vista/acción que ve/gestiona la bandeja completa. */
  isCoordinacion(user: AuthUser): boolean {
    return this.isAdmin(user) || user.roles.includes('incidencias_coordinacion');
  }

  /** Docente: solo su propia incidencia. Coordinación/admin: cualquiera. */
  canViewDetail(user: AuthUser, incidencia: PermissionIncidenciaSubject): boolean {
    if (this.isCoordinacion(user)) return true;
    return incidencia.docenteId === user.id;
  }

  /** Tomar/añadir seguimiento/cerrar: solo coordinación o admin (regla de rol,
   * no de fila — coordinación ve/gestiona TODAS las incidencias, gate
   * funcional decisión 5: varias personas comparten la misma bandeja sin
   * partición). Reevaluada aquí en el servicio, no solo en `@Roles` del
   * controller. */
  canAct(user: AuthUser): boolean {
    return this.isCoordinacion(user);
  }
}
