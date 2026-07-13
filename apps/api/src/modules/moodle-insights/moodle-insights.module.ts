import { Module } from '@nestjs/common';
import { MoodleClientService } from './moodle-client.service';
import { MoodleInsightsController } from './moodle-insights.controller';
import { MoodleQueryService } from './moodle-query.service';
import { MoodleSyncService } from './moodle-sync.service';

/**
 * Primer módulo de negocio hecho a mano sobre el patrón D-011 (D-020/D-021):
 * plantilla de referencia para los módulos que genere la fábrica más adelante.
 * PrismaService y AuditService llegan por los módulos @Global (no se reimportan).
 */
@Module({
  controllers: [MoodleInsightsController],
  providers: [MoodleClientService, MoodleSyncService, MoodleQueryService]
})
export class MoodleInsightsModule {}
