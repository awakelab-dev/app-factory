import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { FactoryActorContext, FactoryActorRole } from './types';

/** Prefijo que distingue un PAT de la Fábrica de un JWT en el header Bearer. */
export const PAT_PREFIX = 'awkf_';

export interface CreateActorInput {
  email: string;
  role: FactoryActorRole;
}

const ACTOR_ROLES: readonly FactoryActorRole[] = ['gerente', 'admin'];

/**
 * Actores de la Fábrica con PAT (auth interina D-036, hasta que exista el
 * SSO — entonces se migra a OAuth sin tocar el contrato de tools). El token
 * es aleatorio de alta entropía (32 bytes) — SHA-256 basta como hash (no hay
 * password que fortalecer con bcrypt) y permite lookup directo por índice
 * único. El token en claro se devuelve UNA vez (create-actor lo imprime);
 * en BD solo vive el hash.
 */
@Injectable()
export class ActorsService {
  constructor(private readonly prisma: PrismaService) {}

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  static isPat(token: string): boolean {
    return token.startsWith(PAT_PREFIX);
  }

  /**
   * Emite un PAT nuevo. Reemitir para un email existente REVOCA sus tokens
   * activos previos (un token vigente por actor — evita PATs olvidados en
   * circulación); las filas viejas se conservan con `revokedAt` (auditoría).
   */
  async createActor(input: CreateActorInput): Promise<{ id: string; email: string; role: FactoryActorRole; token: string }> {
    if (!ACTOR_ROLES.includes(input.role)) {
      throw new BadRequestException(`Rol inválido: "${input.role}" (valores: ${ACTOR_ROLES.join(', ')})`);
    }
    const token = `${PAT_PREFIX}${randomBytes(32).toString('hex')}`;
    const tokenHash = ActorsService.hashToken(token);
    const [, actor] = await this.prisma.$transaction(
      [
        this.prisma.factoryActor.updateMany({
          where: { email: input.email, revokedAt: null },
          data: { revokedAt: new Date() }
        }),
        this.prisma.factoryActor.create({ data: { email: input.email, role: input.role, tokenHash } })
      ],
      // create-actor corre desde el CLI, típicamente contra la managed PG por
      // túnel SSH (D-031): la PRIMERA conexión (conexión perezosa + TLS +
      // túnel) tarda más que el maxWait por defecto de 2s y Prisma aborta con
      // "Unable to start a transaction in the given time" (visto en el Mac de
      // Leonardo, 2026-07-20). Márgenes holgados: no hay concurrencia aquí.
      { maxWait: 15_000, timeout: 30_000 }
    );
    return { id: actor.id, email: actor.email, role: actor.role as FactoryActorRole, token };
  }

  /** Revoca TODOS los tokens activos de un email. Devuelve cuántos revocó. */
  async revokeActor(email: string): Promise<number> {
    const result = await this.prisma.factoryActor.updateMany({
      where: { email, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return result.count;
  }

  /** Resuelve un PAT a su actor. null si no existe o está revocado (el guard responde 401 sin distinguir — no filtra cuál de las dos). */
  async findActiveByToken(token: string): Promise<FactoryActorContext | null> {
    const actor = await this.prisma.factoryActor.findUnique({
      where: { tokenHash: ActorsService.hashToken(token) }
    });
    if (!actor || actor.revokedAt) return null;
    return { email: actor.email, role: actor.role as FactoryActorRole };
  }
}
