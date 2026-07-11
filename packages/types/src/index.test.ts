import { describe, expect, it } from 'vitest';
import { helloResponseSchema } from './index';

describe('helloResponseSchema', () => {
  it('acepta una respuesta válida', () => {
    const result = helloResponseSchema.safeParse({
      service: 'awk-api',
      message: 'hola',
      timestamp: new Date().toISOString()
    });
    expect(result.success).toBe(true);
  });

  it('rechaza timestamp no ISO', () => {
    const result = helloResponseSchema.safeParse({
      service: 'awk-api',
      message: 'hola',
      timestamp: 'ayer'
    });
    expect(result.success).toBe(false);
  });

  it('rechaza campos faltantes', () => {
    expect(helloResponseSchema.safeParse({ message: 'hola' }).success).toBe(false);
  });
});
