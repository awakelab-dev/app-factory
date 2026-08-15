import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Configuración que necesita CUALQUIER runner del Agent SDK (análisis,
 * análisis de cambio, generación) antes de tocar nada.
 *
 * Existe por el bug 1 de D-046: `PLATFORM_REPO_PATH` se leía por primera vez
 * en el `mkdir` posterior a transicionar el proyecto y crear el `Run`, así que
 * un `.env` incompleto dejaba el proyecto atascado en `analyzing` con un run
 * huérfano en `running` — hubo que sanearlo a mano con SQL. Es el bug 2 de
 * D-030 por otra puerta: entonces se movió la transición ANTES de crear el
 * Run, pero la validación del entorno se quedó fuera de las dos.
 *
 * Regla, desde D-047: **validar el entorno en la primera línea del runner**,
 * antes de la transición y antes del Run. Si algo falta, el proyecto se queda
 * exactamente como estaba y el trabajo es reencolable sin saneo manual.
 */
export interface RunnerEnv {
  /** Checkout local del monorepo sobre el que opera el agente. */
  repoPath: string;
}

/** Marcadores que distinguen un checkout del monorepo de una carpeta cualquiera. */
const REPO_MARKERS = ['pnpm-workspace.yaml', 'apps/factory'];

export function assertRunnerEnv(): RunnerEnv {
  const repoPath = process.env.PLATFORM_REPO_PATH;
  if (!repoPath) {
    throw new Error(
      'PLATFORM_REPO_PATH no está configurado — debe apuntar a un checkout local del monorepo app-factory (ver apps/factory/.env.example). ' +
        'Recordatorio de D-046: el checkout del runner necesita su PROPIO apps/factory/.env; no hereda el del working copy.'
    );
  }
  if (!existsSync(repoPath)) {
    throw new Error(`PLATFORM_REPO_PATH apunta a "${repoPath}", que no existe en este proceso.`);
  }
  const missing = REPO_MARKERS.filter((marker) => !existsSync(join(repoPath, marker)));
  if (missing.length > 0) {
    throw new Error(
      `PLATFORM_REPO_PATH ("${repoPath}") no parece un checkout del monorepo app-factory: falta ${missing.join(', ')}.`
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY no está configurada — el Agent SDK no puede correr (ver apps/factory/.env.example).'
    );
  }
  return { repoPath };
}
