import { describe, expect, it } from 'vitest';
import { DashboardPage } from './DashboardPage';

/**
 * Tests básicos de la página de dashboard.
 */
describe('DashboardPage', () => {
  it('debería estar definida', () => {
    expect(DashboardPage).toBeDefined();
  });

  it('debería ser un componente React', () => {
    expect(typeof DashboardPage).toBe('function');
  });
});
