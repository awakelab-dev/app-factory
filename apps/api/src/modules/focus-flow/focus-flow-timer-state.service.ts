import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { toTimerStateDto } from './focus-flow.mappers';
import type { FocusTimerState, PutFocusTimerStateRequest } from './focus-flow.types';

/**
 * Persistencia del ciclo activo del timer (change-2 — spec-tecnica.md
 * "Persistencia del ciclo activo del temporizador"). Fila única por usuario,
 * creada perezosamente en el primer `PUT` (mismo patrón lazy-upsert que
 * `FocusSettingsService`, en tabla separada a propósito: `settings` son
 * preferencias explícitas guardadas por el botón "Guardar cambios";
 * `timer_state` es estado de ejecución que se sobrescribe automáticamente en
 * cada acción del timer).
 *
 * El cliente sigue siendo la autoridad del conteo en curso (`setInterval` de
 * 1s, sin timer server-authoritative): este servicio solo guarda puntos de
 * referencia (`phaseStartedAt`/`accumulatedSeconds`/`running`) para que el
 * cliente reconstruya `remainingSeconds` al recargar/reabrir. Sin auditoría
 * (igual que `FocusSettingsService`): no es una acción que valga la pena
 * auditar.
 */
@Injectable()
export class FocusTimerStateService {
  constructor(private readonly prisma: PrismaService) {}

  /** `null` si el usuario nunca corrió un timer (gate técnico change-2). */
  async get(user: AuthUser): Promise<FocusTimerState | null> {
    const row = await this.prisma.focusTimerState.findUnique({ where: { userId: user.id } });
    return row ? toTimerStateDto(row) : null;
  }

  /**
   * Upsert del estado completo — el cliente llama esto en cada evento
   * discreto (play/pausa, cambio de modo, reset, fin de fase), nunca por
   * tick (gate técnico change-2: evita escrituras cada segundo).
   */
  async upsert(user: AuthUser, dto: PutFocusTimerStateRequest): Promise<FocusTimerState> {
    const data = {
      phase: dto.phase,
      round: dto.round,
      taskId: dto.taskId ?? null,
      phaseStartedAt: dto.phaseStartedAt ? new Date(dto.phaseStartedAt) : null,
      accumulatedSeconds: dto.accumulatedSeconds,
      running: dto.running
    };

    const row = await this.prisma.focusTimerState.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data
    });
    return toTimerStateDto(row);
  }
}
