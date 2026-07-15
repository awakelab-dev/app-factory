import { Module } from '@nestjs/common';
import { OrientadorAcademiesService } from './orientador-academies.service';
import { OrientadorClaudeService } from './orientador-claude.service';
import { OrientadorExportService } from './orientador-export.service';
import { OrientadorIaController } from './orientador-ia.controller';
import { OrientadorIntakeService } from './orientador-intake.service';
import { OrientadorQueryService } from './orientador-query.service';

@Module({
  controllers: [OrientadorIaController],
  providers: [
    OrientadorClaudeService,
    OrientadorIntakeService,
    OrientadorQueryService,
    OrientadorAcademiesService,
    OrientadorExportService
  ]
})
export class OrientadorIaModule {}
