import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { toSettingsDto } from './focus-flow.mappers';
import type { FocusSettings, UpdateFocusSettingsRequest } from './focus-flow.types';

/** Valores por defecto del prototipo (spec-tecnica.md `focus.settings`). */
const SETTINGS_DEFAULTS = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  notificationsEnabled: true
};

/**
 * Configuración personal del temporizador — una fila por usuario, creada
 * perezosamente (spec-tecnica.md: "creada perezosamente en el primer GET").
 * Sin auditoría: ajustar la duración de un pomodoro no es una acción que
 * valga la pena auditar (a diferencia de altas/bajas de tarea).
 */
@Injectable()
export class FocusSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(user: AuthUser): Promise<FocusSettings> {
    const row = await this.prisma.focusSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...SETTINGS_DEFAULTS },
      update: {}
    });
    return toSettingsDto(row);
  }

  async update(user: AuthUser, dto: UpdateFocusSettingsRequest): Promise<FocusSettings> {
    const row = await this.prisma.focusSettings.upsert({
      where: { userId: user.id },
      // Si todavía no existía la fila (nunca se llamó a GET /settings antes
      // de guardar), se crea ya con el patch aplicado sobre los defaults.
      create: { userId: user.id, ...SETTINGS_DEFAULTS, ...dto },
      update: dto
    });
    return toSettingsDto(row);
  }
}
