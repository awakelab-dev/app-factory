import { Controller, Get, Param } from '@nestjs/common';
import type { FactoryProjectDetail, FactoryProjectSummary } from '@awk/types';
import { ProjectsService } from '../pipeline/projects.service';
import { toProjectDetailDto, toProjectSummaryDto } from './mappers';

/**
 * Lectura del pipeline para el control plane (D-030). Solo consume
 * ProjectsService (D-029) — la escritura de estado sigue pasando
 * exclusivamente por la máquina de estados vía GatesService/CLI.
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(): Promise<FactoryProjectSummary[]> {
    const projects = await this.projects.list();
    return projects.map(toProjectSummaryDto);
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<FactoryProjectDetail> {
    const project = await this.projects.getFullStatus(id);
    return toProjectDetailDto(project);
  }
}
