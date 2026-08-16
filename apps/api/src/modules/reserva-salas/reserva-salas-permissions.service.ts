import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';

/** Forma mínima de una reserva que necesita la regla de cancelación. */
export interface PermissionReservaSubject {
  userId: string;
}

/**
 * Reglas de permiso por FILA (no solo por rol) — mismo espíritu que
 * `IncidenciasPermissionsService`/`GestorPermissionsService`: el
 * `RolesGuard` decide si el ROL puede llegar al endpoint (`@Roles('empleado',
 * 'recepcion')` en la mayoría de los endpoints compartidos); este servicio
 * decide si ESTA fila es visible/accionable para ESTE usuario (spec-tecnica.md
 * "Reutilización del core" — primer caso de `@Roles()` combinado con un
 * filtro "solo mías" en el mismo endpoint, `GET /reservas`).
 *
 * Sin `admin`: la spec técnica aprobada de este módulo no incluye ese rol en
 * ningún `@Roles()` (a diferencia de `incidencias-aula`, que sí lo añade por
 * convención) — un usuario `admin` sin `empleado`/`recepcion` no entra al
 * módulo.
 */
@Injectable()
export class ReservaSalasPermissionsService {
  isRecepcion(user: AuthUser): boolean {
    return user.roles.includes('recepcion');
  }

  /** Recepción cancela cualquiera; Empleado solo la suya (spec-tecnica.md,
   * `DELETE /reservas/:id`: "Empleado: solo si user_id = usuario actual"). */
  canCancel(user: AuthUser, reserva: PermissionReservaSubject): boolean {
    return this.isRecepcion(user) || reserva.userId === user.id;
  }
}
