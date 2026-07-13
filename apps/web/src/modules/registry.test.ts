import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@awk/types';
import { accessibleModules, visibleNav } from './registry';

const admin: AuthUser = {
  id: 'u-1',
  email: 'a@awakelab.dev',
  displayName: 'Admin',
  roles: ['admin']
};
const plain: AuthUser = { ...admin, id: 'u-2', roles: ['user'] };

describe('registry (manifests → menú/rutas)', () => {
  it('admin accede a todos los módulos registrados', () => {
    const ids = accessibleModules(admin).map((mod) => mod.manifest.id);
    expect(ids).toEqual(['hello', 'core-admin', 'moodle-insights']);
  });

  it('un usuario sin admin no accede a core-admin (moodle-insights sí, sin requiredRoles)', () => {
    const ids = accessibleModules(plain).map((mod) => mod.manifest.id);
    expect(ids).toEqual(['hello', 'moodle-insights']);
  });

  it('el menú se filtra por roles a nivel ítem', () => {
    expect(visibleNav(admin).map((item) => item.label)).toEqual([
      'Demo Hello',
      'Usuarios',
      'Moodle Insights'
    ]);
    expect(visibleNav(plain).map((item) => item.label)).toEqual(['Demo Hello', 'Moodle Insights']);
  });
});
