import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { commandErrorWithStderr, type GitCommandResult } from './git-client';

const execFileAsync = promisify(execFile);

/**
 * Ruta del CLI de Prisma dentro de un checkout del monorepo.
 *
 * `apps/api/node_modules/.bin/prisma` y NO la raíz: con pnpm el binario se
 * enlaza en el paquete que lo declara como dependencia (apps/api), no en el
 * workspace root — comprobado en el sandbox (no existe
 * `<repo>/node_modules/.bin/prisma`).
 */
export function prismaCliPath(repoPath: string): string {
  return join(repoPath, 'apps/api/node_modules/.bin/prisma');
}

/**
 * Comprueba que el checkout tenga el CLI de Prisma ANTES de gastar un run de
 * agente. Es la regla de D-047 aplicada a la generación de migraciones
 * (incremento D2): validar el entorno en la primera línea del runner, para que
 * un checkout sin `pnpm install` no se descubra 25 minutos y varios dólares
 * más tarde, justo cuando toca escribir la migración.
 *
 * Deliberadamente NO vive en `assertRunnerEnv`: el runner de ANÁLISIS corre en
 * `factory-runner`, cuyo checkout (`/platform-repo`) es efímero y no tiene
 * `node_modules` — exigirle Prisma allí rompería el análisis en producción.
 */
export function assertPrismaCli(repoPath: string): string {
  const cli = prismaCliPath(repoPath);
  if (!existsSync(cli)) {
    throw new Error(
      `No se encuentra el CLI de Prisma en "${cli}" — la generación no podría escribir la migración del módulo (incremento D2). ` +
        'El checkout de generación necesita sus dependencias instaladas ("pnpm install" en la raíz del monorepo). ' +
        'Nota para D3: es exactamente la diferencia entre el worker de análisis (checkout sin toolchain) y el de generación (con node_modules), ver docs/09-incremento-d-cero-consola.md.'
    );
  }
  return cli;
}

/**
 * Wrapper delgado sobre `execFile` para el CLI de Prisma, hermano de
 * `runGit`/`runGh` (git-client.ts) y mockeado del mismo modo: se inyecta la
 * función completa en los tests en vez de parchear `child_process`.
 *
 * Recibe el `repoPath` (no un cwd libre) porque el cwd correcto es siempre
 * `<repo>/apps/api`: ahí está `prisma.config.ts`, de donde Prisma 7 toma el
 * `schema` y el datasource (D-010). Dejarlo a elección de quien llama sería una
 * forma fácil de correr el CLI desde el sitio equivocado.
 */
export async function runPrisma(args: string[], repoPath: string): Promise<GitCommandResult> {
  const cli = assertPrismaCli(repoPath);
  try {
    return await execFileAsync(cli, args, { cwd: join(repoPath, 'apps/api') });
  } catch (error) {
    throw commandErrorWithStderr(error, 'prisma', args);
  }
}
