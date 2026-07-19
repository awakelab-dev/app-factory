import { describe, expect, it } from 'vitest';
import { isWriteAllowed } from './agent-sdk.client';

const CWD = '/repo';

describe('isWriteAllowed', () => {
  it('permite un archivo dentro de la raíz (ruta absoluta)', () => {
    expect(isWriteAllowed('/repo/docs/pipeline/foo/change-2/spec-funcional.md', CWD, ['/repo/docs/pipeline/foo/change-2'])).toBe(
      true
    );
  });

  it('resuelve una ruta relativa contra cwd antes de comparar (regresión del bug 2026-07-19)', () => {
    // El agente pasa la ruta relativa al repo; debe matchear la raíz absoluta.
    expect(
      isWriteAllowed('docs/pipeline/foo/change-2/spec-funcional.md', CWD, ['/repo/docs/pipeline/foo/change-2'])
    ).toBe(true);
  });

  it('deniega una escritura a la raíz del repo fuera del change-<n> (el bug original)', () => {
    // `change-2/...` relativo a cwd resuelve a /repo/change-2, fuera de la raíz.
    expect(isWriteAllowed('change-2/spec-funcional.md', CWD, ['/repo/docs/pipeline/foo/change-2'])).toBe(false);
  });

  it('deniega una escritura fuera de la raíz permitida', () => {
    expect(isWriteAllowed('/repo/apps/api/src/main.ts', CWD, ['/repo/docs/pipeline/foo/change-2'])).toBe(false);
  });

  it('no deja pasar un hermano con prefijo compartido (frontera de segmento)', () => {
    expect(isWriteAllowed('/repo/docs/pipeline/foo-bar/x.md', CWD, ['/repo/docs/pipeline/foo'])).toBe(false);
  });

  it('matchea una raíz que es un archivo por igualdad exacta (p. ej. schema.prisma)', () => {
    const root = '/repo/apps/api/prisma/schema.prisma';
    expect(isWriteAllowed(root, CWD, [root])).toBe(true);
    expect(isWriteAllowed('/repo/apps/api/prisma/schema.prisma.bak', CWD, [root])).toBe(false);
  });

  it('sin writableRoots el guardarraíl está desactivado (permite todo)', () => {
    expect(isWriteAllowed('/cualquier/lado.md', CWD, undefined)).toBe(true);
  });
});
