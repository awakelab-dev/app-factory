import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch } from './api';

afterEach(() => vi.restoreAllMocks());

describe('apiFetch', () => {
  it('trata un 200 sin body (json() lanza) como null — regresión focus-flow timer-state (2026-07-20)', async () => {
    // NestJS envía una respuesta VACÍA cuando un handler devuelve `null` (no el
    // literal JSON `null`); res.json() sobre eso lanza en el navegador.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('empty body')) })
    );
    const result = await apiFetch('/x', z.object({ a: z.string() }).nullable());
    expect(result).toBeNull();
  });

  it('parsea un body JSON normal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ a: 'ok' }) }));
    const result = await apiFetch('/x', z.object({ a: z.string() }));
    expect(result).toEqual({ a: 'ok' });
  });

  it('lanza ApiError en respuestas no-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) }));
    await expect(apiFetch('/x', z.object({ a: z.string() }))).rejects.toThrow(/HTTP 500/);
  });
});
