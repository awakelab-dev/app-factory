import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Roles } from '../../core/auth/auth.decorators';
import { IncidenciasAulasService } from './incidencias-aula-aulas.service';
import { IncidenciasService } from './incidencias-aula-incidencias.service';
import { IncidenciasResumenService } from './incidencias-aula-resumen.service';
import {
  addSeguimientoRequestSchema,
  cerrarIncidenciaRequestSchema,
  createAulaRequestSchema,
  createIncidenciaRequestSchema,
  estadoIncidenciaSchema,
  incidenciaGravedadSchema,
  updateAulaRequestSchema,
  type AddSeguimientoRequest,
  type Aula,
  type CerrarIncidenciaRequest,
  type CreateAulaRequest,
  type CreateIncidenciaRequest,
  type IncidenciaBandejaRow,
  type IncidenciaDetail,
  type IncidenciaGravedad,
  type IncidenciaRow,
  type ResumenMensual,
  type UpdateAulaRequest
} from './incidencias-aula.types';

/**
 * Registro de incidencias de aula/convivencia (spec-tecnica.md
 * `incidencias-aula`). Tres roles de manifest DISJUNTOS sobre la misma
 * entidad (D-011, gate funcional decisión 1 — nombres genéricos, caso
 * INTERNO de Awakelab, sin prefijo de cliente): `incidencias_docente` (alta +
 * lista propia), `incidencias_coordinacion` (bandeja completa + acciones) e
 * `incidencias_direccion` (resumen mensual minimizado, solo agregados). Sin
 * `@Public()`: los tres roles son personal del centro con cuenta en la
 * plataforma (a diferencia de `orientador-ia`). Las reglas de FILA (¿es mi
 * incidencia?, ¿soy coordinación?) NO viven aquí — se revalidan en cada
 * servicio vía `IncidenciasPermissionsService` (spec-tecnica.md "Reglas de
 * permiso por fila"); `@Roles` solo decide si el ROL llega al endpoint.
 *
 * Catálogo de aulas (gate funcional, decisión 4 — AMPLIACIÓN de alcance):
 * lectura para los tres roles + admin, alta/edición SOLO admin. Baja lógica
 * (`activa=false`), nunca `DELETE`.
 */
@Controller('incidencias-aula')
export class IncidenciasAulaController {
  constructor(
    private readonly incidenciasService: IncidenciasService,
    private readonly aulasService: IncidenciasAulasService,
    private readonly resumenService: IncidenciasResumenService
  ) {}

  @Roles('incidencias_docente', 'admin')
  @Post('incidencias')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createIncidenciaRequestSchema)) body: CreateIncidenciaRequest
  ): Promise<IncidenciaRow> {
    return this.incidenciasService.create(user, body);
  }

  // Declarada ANTES de `incidencias/:id`: Nest resuelve por orden de
  // declaración y ambas rutas tienen el mismo número de segmentos — si
  // "mias" fuera después, "incidencias/:id" la capturaría como si :id="mias".
  @Roles('incidencias_docente', 'admin')
  @Get('incidencias/mias')
  mias(@CurrentUser() user: AuthUser): Promise<IncidenciaRow[]> {
    return this.incidenciasService.listMias(user);
  }

  @Roles('incidencias_coordinacion', 'admin')
  @Get('incidencias')
  bandeja(
    @CurrentUser() user: AuthUser,
    @Query('estado', new ZodValidationPipe(estadoIncidenciaSchema.optional())) estado: IncidenciaRow['estado'] | undefined,
    @Query('aulaId') aulaId: string | undefined,
    @Query('gravedad', new ZodValidationPipe(incidenciaGravedadSchema.optional())) gravedad?: IncidenciaGravedad
  ): Promise<IncidenciaBandejaRow[]> {
    return this.incidenciasService.bandeja(user, { estado, aulaId, gravedad });
  }

  @Roles('incidencias_docente', 'incidencias_coordinacion', 'admin')
  @Get('incidencias/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<IncidenciaDetail> {
    return this.incidenciasService.detail(user, id);
  }

  @Roles('incidencias_coordinacion', 'admin')
  @Post('incidencias/:id/tomar')
  tomar(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<IncidenciaDetail> {
    return this.incidenciasService.tomar(user, id);
  }

  @Roles('incidencias_coordinacion', 'admin')
  @Post('incidencias/:id/seguimiento')
  addSeguimiento(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addSeguimientoRequestSchema)) body: AddSeguimientoRequest
  ): Promise<IncidenciaDetail> {
    return this.incidenciasService.addSeguimiento(user, id, body);
  }

  @Roles('incidencias_coordinacion', 'admin')
  @Post('incidencias/:id/cerrar')
  cerrar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cerrarIncidenciaRequestSchema)) body: CerrarIncidenciaRequest
  ): Promise<IncidenciaDetail> {
    return this.incidenciasService.cerrar(user, id, body);
  }

  /**
   * Catálogo para el formulario del docente y los filtros de coordinación:
   * activas por defecto. `todas=true` solo se honra si el requester es admin
   * (pantalla mínima de gestión) — revalidado en el servicio, no solo aquí.
   */
  @Roles('incidencias_docente', 'incidencias_coordinacion', 'incidencias_direccion', 'admin')
  @Get('aulas')
  aulas(@CurrentUser() user: AuthUser, @Query('todas') todas?: string): Promise<Aula[]> {
    return this.aulasService.listForUser(user, todas === 'true' || todas === '1');
  }

  @Roles('admin')
  @Post('aulas')
  createAula(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createAulaRequestSchema)) body: CreateAulaRequest
  ): Promise<Aula> {
    return this.aulasService.create(user, body);
  }

  @Roles('admin')
  @Patch('aulas/:id')
  updateAula(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAulaRequestSchema)) body: UpdateAulaRequest
  ): Promise<Aula> {
    return this.aulasService.update(user, id, body);
  }

  @Roles('incidencias_direccion', 'admin')
  @Get('resumen-mensual')
  resumenMensual(@Query('mes') mes?: string): Promise<ResumenMensual> {
    return this.resumenService.resumenMensual(mes);
  }
}
