import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import type { ActorsService } from '../pipeline/actors.service';
import type { FactoryActorContext } from '../pipeline/types';
import { FactoryAuthGuard } from './factory-auth.guard';

function buildContext(headers: Record<string, string | undefined> = {}) {
  const request: {
    headers: Record<string, string | undefined>;
    user?: unknown;
    actor?: FactoryActorContext;
  } = { headers };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
  return { context, request };
}

function buildGuard(
  options: {
    isPublic?: boolean;
    payload?: unknown;
    verifyFails?: boolean;
    patActor?: FactoryActorContext | null;
  } = {}
) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(options.isPublic ?? false)
  } as unknown as Reflector;
  const jwtService = {
    verifyAsync: options.verifyFails
      ? vi.fn().mockRejectedValue(new Error('bad token'))
      : vi.fn().mockResolvedValue(
          options.payload ?? {
            sub: 'u1',
            email: 'leonardo.barreto@awakelab.dev',
            name: 'Leonardo',
            roles: ['admin']
          }
        )
  } as unknown as JwtService;
  const actors = {
    findActiveByToken: vi.fn().mockResolvedValue(options.patActor ?? null)
  } as unknown as ActorsService;
  return new FactoryAuthGuard(reflector, jwtService, actors);
}

describe('FactoryAuthGuard', () => {
  it('deja pasar rutas @Public (healthcheck) sin token', async () => {
    const guard = buildGuard({ isPublic: true });
    const { context } = buildContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('401 sin header Authorization', async () => {
    const guard = buildGuard();
    const { context } = buildContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('401 con token inválido o expirado', async () => {
    const guard = buildGuard({ verifyFails: true });
    const { context } = buildContext({ authorization: 'Bearer basura' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('403 con JWT válido pero sin rol admin (p. ej. un user normal de la plataforma)', async () => {
    const guard = buildGuard({
      payload: { sub: 'u2', email: 'demo@awakelab.dev', name: 'Demo', roles: ['user'] }
    });
    const { context } = buildContext({ authorization: 'Bearer token-valido' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deja pasar un admin por JWT y adjunta user + actor normalizado {email, rol admin}', async () => {
    const guard = buildGuard();
    const { context, request } = buildContext({ authorization: 'Bearer token-valido' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'u1',
      email: 'leonardo.barreto@awakelab.dev',
      displayName: 'Leonardo',
      roles: ['admin']
    });
    expect(request.actor).toEqual({ email: 'leonardo.barreto@awakelab.dev', role: 'admin' });
  });

  it('deja pasar un PAT activo (prefijo awkf_) y adjunta el actor del token (D-036)', async () => {
    const gerente: FactoryActorContext = { email: 'gerente@awakelab.dev', role: 'gerente' };
    const guard = buildGuard({ patActor: gerente });
    const { context, request } = buildContext({ authorization: 'Bearer awkf_abc123' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.actor).toEqual(gerente);
    // Un PAT nunca pasa por el verificador de JWT ni deja request.user.
    expect(request.user).toBeUndefined();
  });

  it('401 con PAT desconocido o revocado (mismo mensaje: no filtra cuál)', async () => {
    const guard = buildGuard({ patActor: null });
    const { context } = buildContext({ authorization: 'Bearer awkf_revocado' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('un token sin prefijo awkf_ va por la rama JWT, no por la de PATs', async () => {
    const guard = buildGuard({ verifyFails: true, patActor: { email: 'x@y.dev', role: 'gerente' } });
    const { context } = buildContext({ authorization: 'Bearer jwt-cualquiera' });

    // verifyFails: si tocara la rama PAT pasaría; debe fallar como JWT inválido.
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
