import { describe, expect, it } from 'vitest';
import { assertValidTransition, InvalidTransitionError, PROJECT_TRANSITIONS } from './state-machine';

describe('state-machine', () => {
  it('permite el camino feliz completo, paso a paso', () => {
    const path: [Parameters<typeof assertValidTransition>[0], Parameters<typeof assertValidTransition>[1]][] = [
      ['received', 'analyzing'],
      ['analyzing', 'spec_ready'],
      ['spec_ready', 'pending_approval'],
      ['pending_approval', 'generating'],
      ['generating', 'verifying'],
      ['verifying', 'pr_review'],
      ['pr_review', 'staging'],
      ['staging', 'manager_acceptance'],
      ['manager_acceptance', 'deployed']
    ];

    for (const [from, to] of path) {
      expect(() => assertValidTransition(from, to)).not.toThrow();
    }
  });

  it('permite rechazar el proyecto desde pending_approval', () => {
    expect(() => assertValidTransition('pending_approval', 'rejected')).not.toThrow();
  });

  it('permite "complementar" (changes_requested) volviendo a spec_ready antes de generar', () => {
    expect(() => assertValidTransition('pending_approval', 'spec_ready')).not.toThrow();
  });

  it('permite reintentar generación tras un fallo de build/test (verifying → generating)', () => {
    expect(() => assertValidTransition('verifying', 'generating')).not.toThrow();
  });

  it('permite reintentar tras error sin rehacer el análisis (error → generating)', () => {
    expect(() => assertValidTransition('error', 'generating')).not.toThrow();
  });

  it('rechaza saltarse pasos (received → generating)', () => {
    expect(() => assertValidTransition('received', 'generating')).toThrow(InvalidTransitionError);
  });

  it('rechaza transiciones desde el estado terminal rejected', () => {
    expect(() => assertValidTransition('rejected', 'analyzing')).toThrow(InvalidTransitionError);
  });

  it('permite re-entrar el pipeline por request_change desde estados asentados', () => {
    // request_change (docs/04): un módulo ya vivo vuelve a `analyzing` para
    // una iteración de cambio. deployed deja de ser terminal.
    expect(() => assertValidTransition('deployed', 'analyzing')).not.toThrow();
    expect(() => assertValidTransition('staging', 'analyzing')).not.toThrow();
    expect(() => assertValidTransition('manager_acceptance', 'analyzing')).not.toThrow();
  });

  it('permite descartar un cambio/módulo en la revisión (pr_review/manager_acceptance → rejected)', () => {
    expect(() => assertValidTransition('pr_review', 'rejected')).not.toThrow();
    expect(() => assertValidTransition('manager_acceptance', 'rejected')).not.toThrow();
  });

  it('el error incluye origen y destino', () => {
    try {
      assertValidTransition('deployed', 'error');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTransitionError);
      expect((error as InvalidTransitionError).from).toBe('deployed');
      expect((error as InvalidTransitionError).to).toBe('error');
    }
  });

  it('el mensaje sugiere los destinos válidos desde el estado origen', () => {
    try {
      assertValidTransition('received', 'generating');
      expect.unreachable();
    } catch (error) {
      expect((error as InvalidTransitionError).message).toContain('Desde "received" solo se puede pasar a: analyzing.');
    }
  });

  it('el mensaje marca los estados terminales como sin transiciones', () => {
    try {
      assertValidTransition('rejected', 'analyzing');
      expect.unreachable();
    } catch (error) {
      expect((error as InvalidTransitionError).message).toContain('"rejected" es un estado final, no admite transiciones.');
    }
  });

  it('todo estado no terminal tiene al menos una transición válida', () => {
    const terminal = new Set(['rejected']);
    for (const [state, targets] of Object.entries(PROJECT_TRANSITIONS)) {
      if (!terminal.has(state)) {
        expect(targets.length, `estado "${state}" no tiene transiciones salientes`).toBeGreaterThan(0);
      }
    }
  });
});
