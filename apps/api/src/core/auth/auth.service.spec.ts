import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '@awk/auth';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

const jwtService = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });

const leonardoRow = {
  id: 'u-1',
  email: 'leonardo.barreto@awakelab.dev',
  displayName: 'Leonardo Barreto',
  isActive: true,
  roles: [{ role: { name: 'admin' } }, { role: { name: 'user' } }]
};

function makeService(row: unknown) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(row) }
  } as unknown as PrismaService;
  const audit = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  return { service: new AuthService(prisma, jwtService, audit), audit };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AuthService.devLogin', () => {
  it('emite un JWT verificable con los claims del usuario', async () => {
    const { service } = makeService(leonardoRow);
    const result = await service.devLogin(leonardoRow.email);

    const payload = await jwtService.verifyAsync<JwtPayload>(result.accessToken);
    expect(payload.sub).toBe('u-1');
    expect(payload.name).toBe('Leonardo Barreto');
    expect(payload.roles).toEqual(['admin', 'user']);
    expect(result.user.roles).toEqual(['admin', 'user']);
  });

  it('registra el login en auditoría', async () => {
    const { service, audit } = makeService(leonardoRow);
    await service.devLogin(leonardoRow.email);
    expect(audit.log).toHaveBeenCalledWith({ actorId: 'u-1', action: 'auth.dev_login' });
  });

  it('rechaza emails no registrados', async () => {
    const { service } = makeService(null);
    await expect(service.devLogin('nadie@awakelab.dev')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('rechaza usuarios inactivos', async () => {
    const { service } = makeService({ ...leonardoRow, isActive: false });
    await expect(service.devLogin(leonardoRow.email)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('está deshabilitado en producción', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { service } = makeService(leonardoRow);
    await expect(service.devLogin(leonardoRow.email)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
