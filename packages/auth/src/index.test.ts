import { describe, expect, it } from 'vitest';
import { canAccess, hasRole, payloadToUser } from './index';

describe('@awk/auth', () => {
  it('hasRole detecta rol presente', () => {
    expect(hasRole({ roles: ['admin', 'viewer'] }, 'admin')).toBe(true);
  });

  it('hasRole rechaza rol ausente', () => {
    expect(hasRole({ roles: ['viewer'] }, 'admin')).toBe(false);
  });

  it('canAccess permite a cualquiera si no hay requisitos', () => {
    expect(canAccess({ roles: [] })).toBe(true);
    expect(canAccess({ roles: ['user'] }, [])).toBe(true);
  });

  it('canAccess exige al menos un rol coincidente', () => {
    expect(canAccess({ roles: ['user'] }, ['admin'])).toBe(false);
    expect(canAccess({ roles: ['user', 'admin'] }, ['admin'])).toBe(true);
  });

  it('payloadToUser mapea claims a AuthUser', () => {
    const user = payloadToUser({
      sub: 'u1',
      email: 'a@awakelab.dev',
      name: 'Ana',
      roles: ['admin']
    });
    expect(user).toEqual({
      id: 'u1',
      email: 'a@awakelab.dev',
      displayName: 'Ana',
      roles: ['admin']
    });
  });
});
