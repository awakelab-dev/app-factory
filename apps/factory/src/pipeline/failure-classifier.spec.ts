import { describe, expect, it } from 'vitest';
import { backoffMinutes, classifyFailure, MAX_ATTEMPTS } from './failure-classifier';

describe('classifyFailure — infraestructura', () => {
  it('el corte que costó 3,4 USD en D-048 es reintentable', () => {
    expect(classifyFailure(new Error('Connection closed mid-response'))).toBe('retryable');
  });

  it.each([
    'read ECONNRESET',
    'connect ETIMEDOUT 1.2.3.4:443',
    'socket hang up',
    'TypeError: fetch failed',
    'TypeError: terminated',
    'API error: overloaded_error',
    'Request failed with status 429',
    'Request failed with status 503',
    'getaddrinfo EAI_AGAIN api.anthropic.com'
  ])('reintentable: %s', (message) => {
    expect(classifyFailure(new Error(message))).toBe('retryable');
  });
});

describe('classifyFailure — por defecto FATAL', () => {
  it('un mensaje que no reconocemos NO se reintenta (lo caro es el bucle que gasta)', () => {
    expect(classifyFailure(new Error('El run de generación no tuvo éxito.'))).toBe('fatal');
  });

  it.each([
    'La spec spec-1 no tiene todos los gates requeridos (functional, technical) aprobados',
    'Transición de estado inválida: "staging" → "generating"',
    'No existe ninguna spec con id "x"',
    'No se encuentra el CLI de Prisma en "/platform-repo-gen/apps/api/node_modules/.bin/prisma"',
    'PLATFORM_REPO_PATH no está configurado',
    'El agente se detuvo por maxTurns',
    'gh pr merge falló (código 1): HTTP 403: Resource not accessible by personal access token'
  ])('fatal: %s', (message) => {
    expect(classifyFailure(new Error(message))).toBe('fatal');
  });

  it('un build en rojo es fatal aunque su log mencione un 503 (lo fatal gana al patrón de red)', () => {
    // Sin este orden, la salida de un build que descargó algo con un 503
    // reintentaría tres generaciones enteras para volver al mismo error.
    expect(classifyFailure(new Error('turbo run build failed: registry devolvió 503 al bajar un paquete'))).toBe(
      'fatal'
    );
  });

  it('acepta cualquier cosa, no solo Error', () => {
    expect(classifyFailure('socket hang up')).toBe('retryable');
    expect(classifyFailure(undefined)).toBe('fatal');
  });
});

describe('backoffMinutes', () => {
  it('escala 2 → 10 y se agota en el intento máximo', () => {
    expect(backoffMinutes(1)).toBe(2);
    expect(backoffMinutes(2)).toBe(10);
    expect(backoffMinutes(MAX_ATTEMPTS)).toBeNull();
    expect(backoffMinutes(MAX_ATTEMPTS + 5)).toBeNull();
  });
});
