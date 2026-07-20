import { Controller, Get } from '@nestjs/common';
import type { FactoryModuleSummary } from '@awk/types';
import { ProjectsService } from '../pipeline/projects.service';
import { toModuleSummaryDto } from './mappers';

/**
 * Catálogo de módulos (docs/04, list_modules → GET /modules, D-036):
 * antiduplicación desde Cowork. TODOS los actores autenticados lo ven
 * completo (sin scope por rol, deliberado: su función es que un gerente
 * detecte que su idea ya existe aunque el proyecto sea de otro) — solo
 * expone slug/estado/resumen, nunca la spec entera ni la fuente.
 */
@Controller('modules')
export class ModulesController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(): Promise<FactoryModuleSummary[]> {
    const projects = await this.projects.listModules();
    return projects.map(toModuleSummaryDto);
  }
}
