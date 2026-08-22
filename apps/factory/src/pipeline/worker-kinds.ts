import type { AnalysisJobKind } from './types';

/**
 * Qué kinds sirve ESTE proceso worker (D3, docs/09).
 *
 * No es una preferencia de despliegue, es una restricción física: el worker de
 * análisis hace `fetch + reset --hard origin/main + clean` sobre su checkout
 * antes de cada run, y la generación vive en la rama `factory/<slug>` con
 * trabajo sin commitear y `node_modules` instalado. Un solo proceso sirviendo
 * los cuatro kinds sobre un solo working copy es garantía de destrozo — y, con
 * concurrencia 1, una generación de 25 min bloqueando un análisis de 3 min es
 * justo la espera que el gerente sí nota.
 *
 * Por eso el reparto vive en el ENTORNO y no en el código: la misma imagen
 * levanta dos contenedores, `factory-runner` (`analysis,change_analysis`) y
 * `factory-generator` (`generation,pr_merge`).
 */
export const ALL_JOB_KINDS: readonly AnalysisJobKind[] = ['analysis', 'change_analysis', 'generation', 'pr_merge'];

/**
 * Default deliberado: los kinds de ANÁLISIS. Un `factory-runner` ya desplegado
 * que se actualice sin tocar su `.env` sigue haciendo exactamente lo que hacía
 * — nunca empieza a generar (y a empujar a git) por el hecho de actualizarse.
 */
export const DEFAULT_WORKER_KINDS: readonly AnalysisJobKind[] = ['analysis', 'change_analysis'];

/**
 * Lee y valida `FACTORY_WORKER_KINDS` (lista separada por comas). Un valor
 * desconocido es un ERROR, no un aviso: un worker que arranca sirviendo menos
 * kinds de los que su operador cree deja trabajos parados en la cola sin que
 * nada lo grite, y ese es exactamente el síntoma ("no pasa nada") que todo el
 * incremento D existe para eliminar.
 */
export function parseWorkerKinds(raw: string | undefined): readonly AnalysisJobKind[] {
  const value = raw?.trim();
  if (!value) return DEFAULT_WORKER_KINDS;

  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return DEFAULT_WORKER_KINDS;

  const unknown = parts.filter((part) => !(ALL_JOB_KINDS as readonly string[]).includes(part));
  if (unknown.length > 0) {
    throw new Error(
      `FACTORY_WORKER_KINDS contiene kinds desconocidos: ${unknown.join(', ')}. ` +
        `Valores válidos: ${ALL_JOB_KINDS.join(', ')}.`
    );
  }

  // Sin duplicados y en orden estable, para que el log del arranque sea
  // comparable entre contenedores.
  return ALL_JOB_KINDS.filter((kind) => parts.includes(kind));
}
