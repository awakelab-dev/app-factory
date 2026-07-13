import type { MoodleSyncRun } from '@awk/types';

/** Forma mínima que necesitamos de una fila `moodle.sync_runs` de Prisma. */
export interface SyncRunRow {
  id: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  coursesCount: number;
  studentsCount: number;
  enrollmentsCount: number;
  errorMessage: string | null;
}

/** Fila Prisma → contrato @awk/types (fechas a ISO string). */
export function toSyncRunResponse(row: SyncRunRow): MoodleSyncRun {
  return {
    id: row.id,
    status: row.status as MoodleSyncRun['status'],
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    coursesCount: row.coursesCount,
    studentsCount: row.studentsCount,
    enrollmentsCount: row.enrollmentsCount,
    errorMessage: row.errorMessage
  };
}
