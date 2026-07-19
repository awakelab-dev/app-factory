import type { FocusSession, FocusSessionPhase, FocusSettings, FocusTask } from './focus-flow.types';
import { formatDateOnly } from './focus-flow-dates';

// Formas mínimas de fila de Prisma que necesita cada mapper (evita acoplar
// este archivo al tipo generado completo — mismo patrón que
// gestor-proyectos.mappers.ts/orientador-ia.mappers.ts).

export interface SettingsRow {
  id: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  roundsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  notificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toSettingsDto(row: SettingsRow): FocusSettings {
  return {
    id: row.id,
    focusMinutes: row.focusMinutes,
    shortBreakMinutes: row.shortBreakMinutes,
    longBreakMinutes: row.longBreakMinutes,
    roundsBeforeLongBreak: row.roundsBeforeLongBreak,
    autoStartBreaks: row.autoStartBreaks,
    autoStartFocus: row.autoStartFocus,
    notificationsEnabled: row.notificationsEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

/** Fila mínima de `focus.tasks` — incluye `userId` porque los servicios la
 * usan también para revalidar propiedad (`requireOwnTask`). */
export interface TaskRow {
  id: string;
  userId: string;
  title: string;
  estimatedPomodoros: number;
  completedPomodoros: number;
  done: boolean;
  position: number;
  taskDate: Date;
  sourceProyectosTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toTaskDto(row: TaskRow): FocusTask {
  return {
    id: row.id,
    title: row.title,
    estimatedPomodoros: row.estimatedPomodoros,
    completedPomodoros: row.completedPomodoros,
    done: row.done,
    position: row.position,
    taskDate: formatDateOnly(row.taskDate),
    sourceProyectosTaskId: row.sourceProyectosTaskId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export interface SessionRow {
  id: string;
  taskId: string | null;
  phase: FocusSessionPhase;
  startedAt: Date;
  completedAt: Date;
  durationSeconds: number;
  wasSkipped: boolean;
  createdAt: Date;
}

export function toSessionDto(row: SessionRow): FocusSession {
  return {
    id: row.id,
    taskId: row.taskId,
    phase: row.phase,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt.toISOString(),
    durationSeconds: row.durationSeconds,
    wasSkipped: row.wasSkipped,
    createdAt: row.createdAt.toISOString()
  };
}
