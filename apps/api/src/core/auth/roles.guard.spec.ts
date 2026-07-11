import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import { RolesGuard } from './roles.guard';

function makeContext(user?: AuthUser): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) })
  } as unknown as ExecutionContext;
}

function makeGuard(requiredRoles: string[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(requiredRoles)
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

const admin: AuthUser = {
  id: 'u-1',
  email: 'a@awakelab.dev',
  displayName: 'Admin',
  roles: ['admin']
};
const plain: AuthUser = { id: 'u-2', email: 'b@awakelab.dev', displayName: 'User', roles: ['user'] };

describe('RolesGuard', () => {
  it('sin @Roles deja pasar a cualquier autenticado', () => {
    expect(makeGuard(undefined).canActivate(makeContext(plain))).toBe(true);
    expect(makeGuard([]).canActivate(makeContext(plain))).toBe(true);
  });

  it('permite cuando el usuario tiene alguno de los roles requeridos', () => {
    expect(makeGuard(['admin']).canActivate(makeContext(admin))).toBe(true);
  });

  it('deniega con 403 cuando faltan roles', () => {
    expect(() => makeGuard(['admin']).canActivate(makeContext(plain))).toThrow(
      ForbiddenException
    );
  });

  it('deniega si no hay usuario en la request', () => {
    expect(() => makeGuard(['admin']).canActivate(makeContext(undefined))).toThrow(
      ForbiddenException
    );
  });
});
