import { describe, expect, it } from 'vitest';
import { devLoginRequestSchema, helloResponseSchema, moduleManifestSchema } from './index';

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

describe('devLoginRequestSchema', () => {
  it('acepta un email válido', () => {
    expect(devLoginRequestSchema.safeParse({ email: 'a@awakelab.dev' }).success).toBe(true);
  });

  it('rechaza emails inválidos', () => {
    expect(devLoginRequestSchema.safeParse({ email: 'no-es-email' }).success).toBe(false);
  });
});

describe('moduleManifestSchema', () => {
  const base = {
    id: 'core-admin',
    name: 'Administración',
    basePath: '/admin',
    nav: [{ label: 'Usuarios', path: '/admin/usuarios', requiredRoles: ['admin'] }]
  };

  it('acepta un manifest válido (requiredRoles opcional)', () => {
    expect(moduleManifestSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza ids que no sean kebab-case', () => {
    expect(moduleManifestSchema.safeParse({ ...base, id: 'CoreAdmin' }).success).toBe(false);
  });

  it('rechaza paths no absolutas', () => {
    expect(
      moduleManifestSchema.safeParse({ ...base, basePath: 'admin' }).success
    ).toBe(false);
  });
});
