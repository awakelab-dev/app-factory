import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitCommandResult {
  stdout: string;
  stderr: string;
}

/**
 * Wrapper delgado sobre `execFile` para `git`/`gh` (mismo criterio que
 * agent-sdk.client.ts: aísla la forma exacta de Node del resto del código —
 * es el único punto que generation-runner.service.spec.ts mockea, inyectando
 * estas dos funciones completas en vez de parchear `child_process`).
 */
export async function runGit(args: string[], cwd: string): Promise<GitCommandResult> {
  return execFileAsync('git', args, { cwd });
}

export async function runGh(args: string[], cwd: string): Promise<GitCommandResult> {
  return execFileAsync('gh', args, { cwd });
}
