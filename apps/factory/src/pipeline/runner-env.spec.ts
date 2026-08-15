import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertRunnerEnv } from './runner-env';

const originalRepo = process.env.PLATFORM_REPO_PATH;
const originalKey = process.env.ANTHROPIC_API_KEY;

function fakeCheckout(): string {
  const dir = mkdtempSync(join(tmpdir(), 'awkf-repo-'));
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages: []\n');
  mkdirSync(join(dir, 'apps/factory'), { recursive: true });
  return dir;
}

describe('assertRunnerEnv (D-046 bug 1)', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (originalRepo === undefined) delete process.env.PLATFORM_REPO_PATH;
    else process.env.PLATFORM_REPO_PATH = originalRepo;
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('devuelve el checkout cuando el entorno está completo', () => {
    const repo = fakeCheckout();
    process.env.PLATFORM_REPO_PATH = repo;

    expect(assertRunnerEnv()).toEqual({ repoPath: repo });
  });

  it('sin PLATFORM_REPO_PATH, mensaje accionable (incluye la lección del .env propio del checkout)', () => {
    delete process.env.PLATFORM_REPO_PATH;

    expect(() => assertRunnerEnv()).toThrow(/PLATFORM_REPO_PATH/);
    expect(() => assertRunnerEnv()).toThrow(/\.env/);
  });

  it('con una ruta inexistente lo dice, en vez de fallar más tarde en un mkdir', () => {
    process.env.PLATFORM_REPO_PATH = join(tmpdir(), 'no-existe-awkf-12345');

    expect(() => assertRunnerEnv()).toThrow(/que no existe/);
  });

  it('con una carpeta que no es el monorepo, lo detecta por sus marcadores', () => {
    process.env.PLATFORM_REPO_PATH = mkdtempSync(join(tmpdir(), 'awkf-vacio-'));

    expect(() => assertRunnerEnv()).toThrow(/no parece un checkout del monorepo/);
  });

  it('exige ANTHROPIC_API_KEY: sin ella el Agent SDK no puede correr', () => {
    process.env.PLATFORM_REPO_PATH = fakeCheckout();
    delete process.env.ANTHROPIC_API_KEY;

    expect(() => assertRunnerEnv()).toThrow(/ANTHROPIC_API_KEY/);
  });
});
