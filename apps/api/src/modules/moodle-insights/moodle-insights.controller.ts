import { Controller, Get, Logger, Post } from '@nestjs/common';
import type { MoodleCourseRow, MoodleStudentRow, MoodleSummary, MoodleSyncRun } from '@awk/types';
import type { AuthUser } from '@awk/auth';
import { CurrentUser, Roles } from '../../core/auth/auth.decorators';
import { MoodleQueryService } from './moodle-query.service';
import { MoodleSyncService } from './moodle-sync.service';

/**
 * Primer módulo ejemplar de negocio (D-020/D-022): réplica de solo lectura de
 * una instancia Moodle. Lectura abierta a cualquier autenticado; el disparador
 * de sync (llama a un sistema externo y reescribe el replicado) exige admin.
 */
@Controller('moodle-insights')
export class MoodleInsightsController {
  private readonly logger = new Logger(MoodleInsightsController.name);

  constructor(
    private readonly syncService: MoodleSyncService,
    private readonly queryService: MoodleQueryService
  ) {}

  /**
   * Responde en cuanto el sync_run queda creado ('running') — no espera el
   * fetch real a Moodle ni la transacción (puede tardar varios minutos en
   * instancias grandes, ver comentario en MoodleSyncService). El dashboard
   * debe hacer polling de GET /summary hasta que lastSync deje de estar
   * 'running'. processPendingSync nunca lanza (ver su doc), pero el .catch
   * queda como red de seguridad ante cualquier error realmente inesperado.
   */
  @Post('sync')
  @Roles('admin')
  async triggerSync(@CurrentUser() user: AuthUser): Promise<MoodleSyncRun> {
    const run = await this.syncService.start(user.id);
    this.syncService.processPendingSync(run.id, user.id).catch((err) => {
      this.logger.error(`moodle-insights: error inesperado en processPendingSync: ${err}`);
    });
    return run;
  }

  @Get('summary')
  summary(): Promise<MoodleSummary> {
    return this.queryService.summary();
  }

  @Get('courses')
  courses(): Promise<MoodleCourseRow[]> {
    return this.queryService.courses();
  }

  @Get('students')
  students(): Promise<MoodleStudentRow[]> {
    return this.queryService.students();
  }
}
