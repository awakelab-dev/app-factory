import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Roles } from '../../core/auth/auth.decorators';
import { ReservasService } from './reserva-salas-reservas.service';
import { SalasService } from './reserva-salas-salas.service';
import {
  createReservaRequestSchema,
  createSalaRequestSchema,
  dateOnlySchema,
  updateSalaRequestSchema,
  type CreateReservaRequest,
  type CreateSalaRequest,
  type Reserva,
  type Sala,
  type SalaDetail,
  type UpdateSalaRequest
} from './reserva-salas.types';

/**
 * Reserva de Salas (spec-tecnica.md `reserva-salas`): primer módulo con
 * `@Roles()` combinado con un filtro "solo mías" en el MISMO endpoint
 * (`GET /reservas`, spec-tecnica.md "Reutilización del core") — la regla de
 * fila (¿es mi reserva?, ¿soy Recepción?) NO vive aquí, se revalida en cada
 * servicio vía `ReservaSalasPermissionsService`; `@Roles` solo decide si el
 * ROL llega al endpoint.
 *
 * Roles nuevos de manifest, DISJUNTOS de los de `incidencias-aula`:
 * `empleado` (reserva a su nombre, cancela las suyas) y `recepcion` (ve/
 * cancela todas, gestiona el catálogo de salas). Sin `admin` en ningún
 * `@Roles()` de este módulo: la spec técnica aprobada no lo incluye (a
 * diferencia de `incidencias-aula`, que sí lo añade por convención) — un
 * `admin` de plataforma sin uno de estos dos roles no entra.
 */
@Controller('reserva-salas')
export class ReservaSalasController {
  constructor(
    private readonly salasService: SalasService,
    private readonly reservasService: ReservasService
  ) {}

  /**
   * Catálogo para la rejilla de "Reservar" y el formulario de creación:
   * activas por defecto. `todas=true` solo se honra si el requester es
   * Recepción (pantalla de gestión del catálogo) — revalidado en el
   * servicio, no solo aquí.
   */
  @Roles('empleado', 'recepcion')
  @Get('salas')
  salas(@CurrentUser() user: AuthUser, @Query('todas') todas?: string): Promise<Sala[]> {
    return this.salasService.listForUser(user, todas === 'true' || todas === '1');
  }

  @Roles('recepcion')
  @Post('salas')
  createSala(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createSalaRequestSchema)) body: CreateSalaRequest
  ): Promise<Sala> {
    return this.salasService.create(user, body);
  }

  // Declarada ANTES de "salas/:id" no es estrictamente necesaria aquí (no
  // hay ninguna ruta estática tipo "salas/mias" que choque), pero se
  // mantiene el mismo criterio defensivo documentado en
  // `incidencias-aula.controller.ts`: Nest resuelve por orden de
  // declaración cuando dos rutas tienen el mismo número de segmentos.
  @Roles('empleado', 'recepcion')
  @Get('salas/:id')
  salaDetail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('fecha', new ZodValidationPipe(dateOnlySchema.optional())) fecha: string | undefined
  ): Promise<SalaDetail> {
    return this.salasService.detail(user, id, fecha);
  }

  @Roles('recepcion')
  @Put('salas/:id')
  updateSala(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSalaRequestSchema)) body: UpdateSalaRequest
  ): Promise<Sala> {
    return this.salasService.update(user, id, body);
  }

  @Roles('recepcion')
  @Patch('salas/:id/toggle-activa')
  toggleActivaSala(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Sala> {
    return this.salasService.toggleActiva(user, id);
  }

  @Roles('empleado', 'recepcion')
  @Get('reservas')
  reservas(
    @CurrentUser() user: AuthUser,
    @Query('desde', new ZodValidationPipe(dateOnlySchema.optional())) desde: string | undefined
  ): Promise<Reserva[]> {
    return this.reservasService.list(user, { desde });
  }

  @Roles('empleado', 'recepcion')
  @Post('reservas')
  createReserva(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createReservaRequestSchema)) body: CreateReservaRequest
  ): Promise<Reserva> {
    return this.reservasService.create(user, body);
  }

  @Roles('empleado', 'recepcion')
  @Delete('reservas/:id')
  @HttpCode(204)
  async cancelReserva(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.reservasService.cancel(user, id);
  }
}
