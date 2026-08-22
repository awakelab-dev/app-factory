/**
 * ¿Este fallo merece un reintento automático? (D3, docs/09).
 *
 * El problema real: en D-048 un `generate` de 25 minutos murió con
 * "Connection closed mid-response" a mitad del run. Costó 3,4 USD y no dejó
 * nada — y la única forma de retomarlo era que Sistemas volviera a lanzarlo a
 * mano. Un corte de red no es un error del pipeline; un build en rojo sí.
 *
 * Regla de oro, y es deliberadamente asimétrica: **por defecto, FATAL**. Lo
 * caro es un bucle que reintenta tres veces un fallo determinista gastando un
 * agente en cada vuelta (~8 USD el módulo); lo barato es reencolar a mano un
 * caso que todavía no sabemos clasificar. Cuando aparezca un patrón nuevo de
 * infraestructura, se añade AQUÍ con su fecha y su caso.
 */
export type FailureClass = 'retryable' | 'fatal';

/**
 * Síntomas de INFRAESTRUCTURA (red, API del modelo, servidor del otro lado).
 * Se comparan contra el mensaje completo en minúsculas, así que van en
 * minúsculas. Cada uno viene de un fallo observado o del catálogo de errores
 * transitorios del SDK/undici — nada especulativo.
 */
const RETRYABLE_PATTERNS: readonly RegExp[] = [
  // El caso de D-048, literal: el stream del Agent SDK se corta a mitad.
  /connection closed mid-response/,
  /econnreset/,
  /etimedout/,
  /econnrefused/,
  /enetunreach/,
  /eai_again/, // fallo de DNS transitorio
  /socket hang up/,
  /socket disconnected/,
  // `fetch failed` es el envoltorio de undici para casi cualquier corte de red.
  /fetch failed/,
  // `TypeError: terminated` es como undici reporta un body cortado a mitad.
  /\bterminated\b/,
  // API de Anthropic saturada o caída: 429 y 5xx son reintentables por
  // definición; 4xx que no sea 429 NO (contrato mal usado, clave inválida).
  /overloaded_error/,
  /rate.?limit/,
  /\b429\b/,
  /\b50[0234]\b/,
  /internal server error/,
  /service unavailable/,
  /bad gateway/,
  /gateway timeout/
];

/**
 * Síntomas de que el problema es NUESTRO (o del agente) y reintentar solo
 * gastaría dinero para volver al mismo sitio. Se evalúan ANTES que los
 * reintentables: un "build falló ... 503 en un log" no puede colarse como
 * fallo de red por una coincidencia de texto dentro de la salida del build.
 */
const FATAL_PATTERNS: readonly RegExp[] = [
  // Contrato del pipeline.
  /no tiene todos los gates requeridos/,
  /transición de estado inválida/,
  /no existe ninguna spec con id/,
  /es un projectid, no un specid/,
  /no se encuentra el cli de prisma/,
  /platform_repo_path/,
  /anthropic_api_key no está configurada/,
  // El agente se quedó sin turnos o violó el guardarraíl: reintentar da igual.
  /maxturns|max_turns|límite de turnos/,
  /permission denied by hook|write blocked|fuera de writableroots/,
  // Build/lint/test en rojo TRAS los reintentos del propio agente.
  /\b(build|lint|typecheck|tests?)\b.{0,40}\b(failed|failing|en rojo|falló|fallaron)\b/,
  /turbo run .*(failed|error)/,
  // Credencial mal puesta: reintentar tres veces no la arregla.
  /authentication failed|bad credentials|invalid api key|invalid_api_key|\b401\b|\b403\b/
];

/**
 * `error` puede ser un Error, un string o cualquier cosa: los runners
 * propagan mensajes ya normalizados, pero el bucle del worker atrapa lo que
 * venga.
 */
export function classifyFailure(error: unknown): FailureClass {
  const message = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).toLowerCase();
  if (FATAL_PATTERNS.some((pattern) => pattern.test(message))) return 'fatal';
  if (RETRYABLE_PATTERNS.some((pattern) => pattern.test(message))) return 'retryable';
  return 'fatal';
}

/**
 * Escalera del backoff, en minutos, indexada por el número de intentos YA
 * hechos (`attempts` tras el `claimNext` que falló).
 *
 * Sobre el número de intentos: el diseño de docs/09 dice a la vez
 * "attempts < 3" y "2 → 10 → 30 min", que no pueden ser las dos cosas. Se
 * implementa lo primero —tres ejecuciones como máximo, dos reintentos— porque
 * es la regla precisa y la conservadora con el gasto: un tercer reintento de
 * una generación son ~8 USD más por un fallo que ya se repitió tres veces. Si
 * un caso real pide la tercera vuelta, se sube `MAX_ATTEMPTS` y se añade el 30
 * aquí (decisión anotada en DECISIONES, D3).
 */
export const RETRY_BACKOFF_MINUTES: readonly number[] = [2, 10];

/** Ejecuciones como máximo por trabajo, incluida la primera. */
export const MAX_ATTEMPTS = 3;

/**
 * Minutos que hay que esperar antes del siguiente intento, o `null` si ya no
 * quedan intentos.
 */
export function backoffMinutes(attempts: number): number | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  return RETRY_BACKOFF_MINUTES[attempts - 1] ?? RETRY_BACKOFF_MINUTES[RETRY_BACKOFF_MINUTES.length - 1] ?? null;
}
