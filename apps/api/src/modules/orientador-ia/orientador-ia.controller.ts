import { Body, Controller, Get, Header, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  orientadorAcademyUpdateSchema,
  orientadorIntakeRequestSchema,
  type OrientadorAcademy,
  type OrientadorAcademyUpdate,
  type OrientadorIntakeRequest,
  type OrientadorIntakeResponse,
  type OrientadorLeadRow
} from '@awk/types';
import type { AuthUser } from '@awk/auth';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Public, Roles } from '../../core/auth/auth.decorators';
import { OrientadorAcademiesService } from './orientador-academies.service';
import { OrientadorExportService } from './orientador-export.service';
import { OrientadorIntakeService } from './orientador-intake.service';
import { OrientadorQueryService } from './orientador-query.service';

/**
 * Rutas del candidato (@Public(), sin login) y del panel admin del cliente
 * (@Roles('orientador_admin'), acotado a este módulo — D-011/D-025). Ver
 * docs/pipeline/orientador-ia/ para la spec completa.
 */
@Controller('orientador-ia')
export class OrientadorIaController {
  constructor(
    private readonly intakeService: OrientadorIntakeService,
    private readonly queryService: OrientadorQueryService,
    private readonly academiesService: OrientadorAcademiesService,
    private readonly exportService: OrientadorExportService
  ) {}

  @Public()
  @HttpCode(200)
  @Post('intake')
  submit(
    @Body(new ZodValidationPipe(orientadorIntakeRequestSchema)) body: OrientadorIntakeRequest
  ): Promise<OrientadorIntakeResponse> {
    return this.intakeService.submit(body);
  }

  /** Contenido activo para el flujo del candidato — sin datos de administración. */
  @Public()
  @Get('academies')
  publicAcademies(): Promise<OrientadorAcademy[]> {
    return this.queryService.academies(true);
  }

  @Roles('orientador_admin')
  @Get('admin/leads')
  leads(): Promise<OrientadorLeadRow[]> {
    return this.queryService.leads();
  }

  @Roles('orientador_admin')
  @Get('admin/leads/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="orientador-ia-leads.csv"')
  exportLeads(@CurrentUser() user: AuthUser): Promise<string> {
    return this.exportService.exportLeadsCsv(user.id);
  }

  /** Catálogo completo (incl. inactivas) para el panel admin. */
  @Roles('orientador_admin')
  @Get('admin/academies')
  adminAcademies(): Promise<OrientadorAcademy[]> {
    return this.queryService.academies(false);
  }

  @Roles('orientador_admin')
  @Put('admin/academies/:id')
  updateAcademy(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(orientadorAcademyUpdateSchema)) body: OrientadorAcademyUpdate
  ): Promise<OrientadorAcademy> {
    return this.academiesService.update(id, body);
  }
}
