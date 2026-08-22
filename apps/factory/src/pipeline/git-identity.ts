import { Logger } from '@nestjs/common';
import { runGh, runGit } from './git-client';

const logger = new Logger('GitIdentity');

/** Autor de los commits que hace la Fábrica. Configurable por si cambia el buzón. */
const DEFAULT_COMMIT_NAME = 'AwkFactory';
const DEFAULT_COMMIT_EMAIL = 'factory@awakelab.dev';

export interface GitIdentityDeps {
  runGit?: typeof runGit;
  runGh?: typeof runGh;
  env?: NodeJS.ProcessEnv;
}

/**
 * Deja el checkout de GENERACIÓN en condiciones de commitear y empujar (D3).
 *
 * Hasta D2 la generación corría en el Mac de Leonardo, donde git lleva años
 * configurado; en el contenedor no hay NADA de eso, y cada pieza que falta
 * rompe en un sitio distinto y con un mensaje que no se parece al problema:
 *
 *  1. **`user.name`/`user.email`**: sin ellos `git commit` falla con
 *     "Please tell me who you are" DESPUÉS de que el agente haya trabajado 25
 *     minutos y gastado ~8 USD. Es el fallo más caro posible por la causa más
 *     tonta.
 *  2. **`safe.directory`**: el checkout está montado desde el host y su dueño
 *     (uid del host) no es el del proceso del contenedor → git aborta con
 *     "detected dubious ownership" antes de leer nada.
 *  3. **`gh auth setup-git`**: instala el credential helper que hace que
 *     `git push` por HTTPS use el PAT. Sin esto habría que escribir el token en
 *     un `.git-credentials` o en la URL del remoto — es decir, dejarlo en disco
 *     o en los logs.
 *  4. **remoto HTTPS**: el checkout del análisis usa `git@github.com:` con una
 *     deploy key de solo lectura. El de generación tiene que empujar, y el PAT
 *     solo sirve por HTTPS. Se reescribe el remoto SOLO si se configuró
 *     `PLATFORM_REPO_REMOTE_URL` — para no tocar un checkout que ya esté bien.
 *
 * Todo es idempotente y corre una vez al arrancar el worker. Falla RUIDOSO
 * (lanza) si no puede dejar la identidad puesta: más vale que el contenedor no
 * levante a que se descubra al final del primer run.
 */
export async function configureGitForGeneration(repoPath: string, deps: GitIdentityDeps = {}): Promise<void> {
  const gitRunner = deps.runGit ?? runGit;
  const ghRunner = deps.runGh ?? runGh;
  const env = deps.env ?? process.env;

  await gitRunner(['config', '--global', '--add', 'safe.directory', repoPath], repoPath);
  await gitRunner(['config', 'user.name', env.FACTORY_GIT_USER_NAME || DEFAULT_COMMIT_NAME], repoPath);
  await gitRunner(['config', 'user.email', env.FACTORY_GIT_USER_EMAIL || DEFAULT_COMMIT_EMAIL], repoPath);

  const remoteUrl = env.PLATFORM_REPO_REMOTE_URL?.trim();
  if (remoteUrl) {
    await gitRunner(['remote', 'set-url', 'origin', remoteUrl], repoPath);
    logger.log(`Remoto "origin" del checkout de generación apuntado a ${remoteUrl}.`);
  }

  // `gh auth setup-git` necesita el token en GH_TOKEN/GITHUB_TOKEN. Si no está,
  // no se intenta: el error de `gh` sería críptico y el mensaje de abajo dice
  // exactamente qué falta.
  if (!env.GH_TOKEN && !env.GITHUB_TOKEN) {
    throw new Error(
      'Falta GH_TOKEN (o GITHUB_TOKEN) en el worker de generación — sin él no hay push ni PR ni merge. ' +
        'Debe ser un PAT fine-grained del repo con contents:write + pull_requests:write (docs/09, D3).'
    );
  }
  await ghRunner(['auth', 'setup-git'], repoPath);
  logger.log('Credencial de git configurada vía `gh auth setup-git` (push por HTTPS con el PAT).');
}
