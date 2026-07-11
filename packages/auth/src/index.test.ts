import { describe, expect, it } from 'vitest';
import { getDevUser, hasRole } from './index';

describe('@awk/auth (stub)', () => {
  it('hasRole detecta rol presente', () => {
    expect(hasRole({ roles: ['admin', 'viewer'] }, 'admin')).toBe(true);
  });

  it('hasRole rechaza rol ausente', () => {
    expect(hasRole({ roles: ['viewer'] }, 'admin')).toBe(false);
  });

  it('getDevUser devuelve un usuario coherente', () => {
    const user = getDevUser();
    expect(user.id).toBe('dev-user');
    expect(hasRole(user, 'admin')).toBe(true);
  });
});
