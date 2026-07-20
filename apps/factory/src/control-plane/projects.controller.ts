import { Controller, Get, Param } from '@nestjs/common';
import type { FactoryProjectDetail, FactoryProjectSummary } from '@awk/types';
import { ProjectsService } from '../pipeline/projects.service';
import type { FactoryActorContext } from '../pipeline/types';
import { CurrentActor } from './current-actor.decorator';
import { toProjectDetailDto, toProjectSummaryDto } from './mappers';

/**
 * Lectura del pipeline para el control plane (D-030). Solo consume
 * ProjectsService (D-029) — la escritura de estado sigue pasando
 * exclusivamente por la máquina de estados vía GatesService/CLI.
 * Scope por rol desde D-036: un actor `gerente` (PAT) solo ve SUS
 * proyectos; un admin (JWT o PAT), todos.
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(@CurrentActor() actor: FactoryActorContext): Promise<FactoryProjectSummary[]> {
    const projects = await this.projects.list(actor);
    return projects.map(toProjectSummaryDto);
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentActor() actor: FactoryActorContext): Promise<FactoryProjectDetail> {
    const project = await this.projects.getFullStatus(id, actor);
    return toProjectDetailDto(project);
  }
}
