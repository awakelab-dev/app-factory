import { Controller, Get, Post } from '@nestjs/common';
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
  constructor(
    private readonly syncService: MoodleSyncService,
    private readonly queryService: MoodleQueryService
  ) {}

  @Post('sync')
  @Roles('admin')
  triggerSync(@CurrentUser() user: AuthUser): Promise<MoodleSyncRun> {
    return this.syncService.run(user.id);
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
