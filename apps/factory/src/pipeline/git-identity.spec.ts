import { describe, expect, it, vi } from 'vitest';
import { configureGitForGeneration } from './git-identity';
import type { runGh, runGit } from './git-client';

function deps(env: NodeJS.ProcessEnv = { GH_TOKEN: 'ghp_x' }) {
  const gitCalls: string[][] = [];
  const ghCalls: string[][] = [];
  return {
    gitCalls,
    ghCalls,
    deps: {
      env,
      runGit: vi.fn(async (args: string[]) => {
        gitCalls.push(args);
        return { stdout: '', stderr: '' };
      }) as unknown as typeof runGit,
      runGh: vi.fn(async (args: string[]) => {
        ghCalls.push(args);
        return { stdout: '', stderr: '' };
      }) as unknown as typeof runGh
    }
  };
}

describe('configureGitForGeneration', () => {
  it('deja identidad, safe.directory y credencial listas ANTES del primer run', async () => {
    const { deps: d, gitCalls, ghCalls } = deps();

    await configureGitForGeneration('/platform-repo-gen', d);

    // Sin user.email, `git commit` falla DESPUÉS de 25 min de agente y ~8 USD.
    expect(gitCalls).toContainEqual(['config', 'user.email', 'factory@awakelab.dev']);
    expect(gitCalls).toContainEqual(['config', 'user.name', 'AwkFactory']);
    // Checkout montado desde el host: sin esto git aborta por "dubious ownership".
    expect(gitCalls).toContainEqual(['config', '--global', '--add', 'safe.directory', '/platform-repo-gen']);
    expect(ghCalls).toContainEqual(['auth', 'setup-git']);
  });

  it('respeta el buzón configurado por entorno', async () => {
    const { deps: d, gitCalls } = deps({ GH_TOKEN: 'x', FACTORY_GIT_USER_EMAIL: 'bot@awakelab.dev' });

    await configureGitForGeneration('/repo', d);

    expect(gitCalls).toContainEqual(['config', 'user.email', 'bot@awakelab.dev']);
  });

  it('reapunta el remoto a HTTPS solo si se pidió (el PAT no sirve por SSH)', async () => {
    const withUrl = deps({ GH_TOKEN: 'x', PLATFORM_REPO_REMOTE_URL: 'https://github.com/awakelab-dev/app-factory.git' });
    await configureGitForGeneration('/repo', withUrl.deps);
    expect(withUrl.gitCalls).toContainEqual([
      'remote',
      'set-url',
      'origin',
      'https://github.com/awakelab-dev/app-factory.git'
    ]);

    const withoutUrl = deps();
    await configureGitForGeneration('/repo', withoutUrl.deps);
    expect(withoutUrl.gitCalls.some((args) => args[0] === 'remote')).toBe(false);
  });

  it('sin PAT falla con un mensaje que dice exactamente qué falta', async () => {
    const { deps: d, ghCalls } = deps({});

    await expect(configureGitForGeneration('/repo', d)).rejects.toThrow(/GH_TOKEN/);
    expect(ghCalls).toHaveLength(0);
  });
});
