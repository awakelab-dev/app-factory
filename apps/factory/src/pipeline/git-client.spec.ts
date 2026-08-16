import { describe, expect, it } from 'vitest';
import { runGit } from './git-client';

/**
 * Regresión del diagnóstico a ciegas del 2026-08-16 (D-047): el worker no podía
 * sincronizar su checkout en el Lightsail y el log solo decía
 * `Command failed: git fetch --prune --quiet`. El motivo real venía en el stderr
 * de git, que el wrapper tiraba a la basura.
 */
describe('runGit — el error lleva el motivo real de git, no solo el comando', () => {
  it('incluye el stderr de git en el mensaje', async () => {
    // Comando válido, repositorio inexistente: git escribe el motivo en stderr.
    await expect(runGit(['status'], '/tmp/no-existe-este-repo-awkf')).rejects.toThrow(/git status falló/);
  });

  it('conserva el texto de git que otros pasos usan para decidir (p. ej. "already exists")', async () => {
    try {
      await runGit(['rev-parse', '--verify', 'rama-que-no-existe'], '/tmp');
      throw new Error('debería haber fallado');
    } catch (error) {
      // El mensaje enriquecido sigue conteniendo la salida de git, que es de
      // donde `createOrReuseBranch` deduce que la rama ya existía.
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('git rev-parse');
    }
  });
});
