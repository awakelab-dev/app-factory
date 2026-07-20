import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch } from './api';

afterEach(() => vi.restoreAllMocks());

describe('apiFetch', () => {
  it('trata un 200 con body vacío como null (GET nullable — regresión focus-flow timer-state, 2026-07-20)', async () => {
    // NestJS envía una respuesta VACÍA cuando un handler devuelve `null` (no el
    // literal JSON `null`); `res.json()` sobre eso lanzaba en el navegador.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));
    const result = await apiFetch('/x', z.object({ a: z.string() }).nullable());
    expect(result).toBeNull();
  });

  it('parsea un body JSON normal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ a: 'ok' }), { status: 200 })));
    const result = await apiFetch('/x', z.object({ a: z.string() }));
    expect(result).toEqual({ a: 'ok' });
  });

  it('lanza ApiError en respuestas no-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(apiFetch('/x', z.object({ a: z.string() }))).rejects.toThrow(/HTTP 500/);
  });
});
