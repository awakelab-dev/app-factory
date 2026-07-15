import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { FactoryAuthGuard } from './factory-auth.guard';

function buildContext(headers: Record<string, string | undefined> = {}) {
  const request: { headers: Record<string, string | undefined>; user?: unknown } = { headers };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
  return { context, request };
}

function buildGuard(options: { isPublic?: boolean; payload?: unknown; verifyFails?: boolean } = {}) {
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
  return new FactoryAuthGuard(reflector, jwtService);
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

  it('deja pasar un admin y adjunta el AuthUser a request.user (para @CurrentUser)', async () => {
    const guard = buildGuard();
    const { context, request } = buildContext({ authorization: 'Bearer token-valido' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'u1',
      email: 'leonardo.barreto@awakelab.dev',
      displayName: 'Leonardo',
      roles: ['admin']
    });
  });
});
