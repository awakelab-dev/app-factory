import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKER_KINDS, parseWorkerKinds } from './worker-kinds';

describe('parseWorkerKinds', () => {
  it('sin configurar sirve solo los kinds de ANÁLISIS', () => {
    // Un `factory-runner` que se actualiza sin tocar su .env no debe empezar a
    // generar (y a empujar a git) por el hecho de actualizarse.
    expect(parseWorkerKinds(undefined)).toEqual(DEFAULT_WORKER_KINDS);
    expect(parseWorkerKinds('   ')).toEqual(DEFAULT_WORKER_KINDS);
  });

  it('lee la lista del generador tolerando espacios y duplicados', () => {
    expect(parseWorkerKinds(' generation , pr_merge ,generation')).toEqual(['generation', 'pr_merge']);
  });

  it('devuelve los kinds en orden estable, no en el del .env', () => {
    expect(parseWorkerKinds('pr_merge,generation')).toEqual(['generation', 'pr_merge']);
  });

  it('un kind desconocido es un ERROR de arranque, no un aviso', () => {
    // Un worker que sirve menos kinds de los que su operador cree deja trabajos
    // parados sin que nada lo grite: el síntoma "no pasa nada" que el
    // incremento D existe para eliminar.
    expect(() => parseWorkerKinds('generation,merge')).toThrow(/merge/);
  });
});
