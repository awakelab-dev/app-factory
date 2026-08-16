import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertRunnerEnv } from './runner-env';

/**
 * Estos tests NO tocan `process.env`: le pasan a `assertRunnerEnv` un entorno
 * propio. En vitest, los archivos de test que corren a la vez pueden compartir
 * `process.env`, así que un `delete process.env.X` aquí podía tumbar a otro
 * archivo a mitad de su ejecución — un falso negativo que solo aparece según
 * cómo se reparta la carga (y por tanto, sobre todo en CI).
 */
function fakeCheckout(): string {
  const dir = mkdtempSync(join(tmpdir(), 'awkf-repo-'));
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages: []\n');
  mkdirSync(join(dir, 'apps/factory'), { recursive: true });
  return dir;
}

const conClave = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({ ANTHROPIC_API_KEY: 'test-key', ...extra });

describe('assertRunnerEnv (D-046 bug 1)', () => {
  it('devuelve el checkout cuando el entorno está completo', () => {
    const repo = fakeCheckout();

    expect(assertRunnerEnv(conClave({ PLATFORM_REPO_PATH: repo }))).toEqual({ repoPath: repo });
  });

  it('sin PLATFORM_REPO_PATH, mensaje accionable (incluye la lección del .env propio del checkout)', () => {
    expect(() => assertRunnerEnv(conClave())).toThrow(/PLATFORM_REPO_PATH/);
    expect(() => assertRunnerEnv(conClave())).toThrow(/\.env/);
  });

  it('con una ruta inexistente lo dice, en vez de fallar más tarde en un mkdir', () => {
    const env = conClave({ PLATFORM_REPO_PATH: join(tmpdir(), 'no-existe-awkf-12345') });

    expect(() => assertRunnerEnv(env)).toThrow(/que no existe/);
  });

  it('con una carpeta que no es el monorepo, lo detecta por sus marcadores', () => {
    const env = conClave({ PLATFORM_REPO_PATH: mkdtempSync(join(tmpdir(), 'awkf-vacio-')) });

    expect(() => assertRunnerEnv(env)).toThrow(/no parece un checkout del monorepo/);
  });

  it('exige ANTHROPIC_API_KEY: sin ella el Agent SDK no puede correr', () => {
    expect(() => assertRunnerEnv({ PLATFORM_REPO_PATH: fakeCheckout() })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('por defecto lee del entorno del proceso (así lo llaman los runners en producción)', () => {
    const repo = fakeCheckout();
    const previo = { repo: process.env.PLATFORM_REPO_PATH, key: process.env.ANTHROPIC_API_KEY };
    process.env.PLATFORM_REPO_PATH = repo;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    try {
      expect(assertRunnerEnv()).toEqual({ repoPath: repo });
    } finally {
      // Se restaura siempre: este es el ÚNICO test del archivo que toca el
      // entorno compartido, y nunca lo deja peor de como estaba.
      if (previo.repo === undefined) delete process.env.PLATFORM_REPO_PATH;
      else process.env.PLATFORM_REPO_PATH = previo.repo;
      if (previo.key === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = previo.key;
    }
  });
});
