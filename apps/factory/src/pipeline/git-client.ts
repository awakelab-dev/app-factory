import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitCommandResult {
  stdout: string;
  stderr: string;
}

/**
 * Convierte el error de `execFile` en uno con el motivo REAL del comando.
 *
 * Node deja el mensaje en `Command failed: git fetch --prune --quiet` y esconde
 * el stderr en una propiedad del error, así que los logs de los runners
 * mostraban el comando que falló pero nunca por qué. Costó un diagnóstico a
 * ciegas la primera vez que el worker no pudo sincronizar su checkout en el
 * Lightsail (2026-08-16, D-047): el stderr decía exactamente qué faltaba y no
 * llegó a ningún log. El texto original se conserva al final porque hay código
 * que discrimina por él (`already exists` al crear la rama en la generación).
 *
 * Exportada desde D2 porque `prisma-client.ts` necesita exactamente el mismo
 * enriquecimiento: `prisma migrate diff` deja el motivo útil (schema inválido,
 * flag desconocida) en stderr y sin esto solo se vería "Command failed".
 */
export function commandErrorWithStderr(error: unknown, command: string, args: string[]): Error {
  const detail = error as { stderr?: string; stdout?: string; message?: string; code?: number };
  const motivo = (detail.stderr || detail.stdout || '').trim();
  const salida = typeof detail.code === 'number' ? ` (código ${detail.code})` : '';
  const enriquecido = new Error(
    `${command} ${args.join(' ')} falló${salida}${motivo ? `: ${motivo}` : ''}` +
      (detail.message && !motivo ? `: ${detail.message}` : '')
  );
  enriquecido.name = 'GitCommandError';
  return enriquecido;
}

/**
 * Wrapper delgado sobre `execFile` para `git`/`gh` (mismo criterio que
 * agent-sdk.client.ts: aísla la forma exacta de Node del resto del código —
 * es el único punto que generation-runner.service.spec.ts mockea, inyectando
 * estas dos funciones completas en vez de parchear `child_process`).
 */
export async function runGit(args: string[], cwd: string): Promise<GitCommandResult> {
  try {
    return await execFileAsync('git', args, { cwd });
  } catch (error) {
    throw commandErrorWithStderr(error, 'git', args);
  }
}

export interface GhOptions {
  /**
   * Corta el comando pasado este tiempo. Existe por `gh pr checks --watch`
   * (D3): espera a que la CI termine, y si la CI se cuelga esperaría PARA
   * SIEMPRE, dejando al worker de generación sin tomar nada más. Con timeout,
   * el trabajo cae, se clasifica como reintentable y vuelve solo.
   */
  timeoutMs?: number;
  /** Salida máxima a capturar; `gh pr checks --watch` repinta mucho. */
  maxBuffer?: number;
}

export async function runGh(args: string[], cwd: string, options: GhOptions = {}): Promise<GitCommandResult> {
  try {
    return await execFileAsync('gh', args, {
      cwd,
      timeout: options.timeoutMs ?? 0,
      maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024
    });
  } catch (error) {
    // `killed` = lo matamos NOSOTROS por timeout. Sin este caso aparte, el
    // mensaje sería "Command failed" a secas y `classifyFailure` lo daría por
    // fatal (su default), cuando una CI que tarda de más es justo lo que hay
    // que reintentar.
    if ((error as { killed?: boolean }).killed && options.timeoutMs) {
      const timeoutError = new Error(
        `gh ${args.join(' ')} superó el tiempo máximo de ${Math.round(options.timeoutMs / 60000)} min (ETIMEDOUT).`
      );
      timeoutError.name = 'GhTimeoutError';
      throw timeoutError;
    }
    throw commandErrorWithStderr(error, 'gh', args);
  }
}
