// `@anthropic-ai/claude-agent-sdk` es un paquete ESM puro (sin condición
// "require" en su package.json) — un `import` estático (de valores O de
// solo tipos) en este archivo CommonJS (D-029: apps/factory sigue el patrón
// commonjs/node16 de apps/api) no resuelve bajo "module: node16" sin una
// sintaxis extra de "resolution-mode" (TS1479/TS1541/TS1542). Dos ajustes
// evitan esa fricción sin acoplar todo el módulo a "module: esnext":
// - `query` se carga con `import()` dinámico (el propio compilador lo
//   sugiere) — funciona igual en runtime, Node 22 soporta el interop.
// - `PermissionResult` no se importa como tipo: se declara localmente con la
//   misma forma (estructuralmente compatible, es lo único que TypeScript
//   necesita para aceptar el valor de retorno de `canUseTool`).
// Sin anotación de tipo explícita a propósito: escribirla requeriría
// referenciar el tipo del módulo ESM (`typeof import('...').query`), que cae
// en el mismo TS1542 que el import de tipos de arriba. Se infiere del propio
// `import()` dinámico, que sí es válido sin "resolution-mode" al ser una
// expresión de valor, no una posición de tipo.
async function loadQuery() {
  const sdk = await import('@anthropic-ai/claude-agent-sdk');
  return sdk.query;
}

import { isAbsolute, resolve } from 'node:path';

type LocalPermissionResult = { behavior: 'allow'; message?: string } | { behavior: 'deny'; message: string };

/**
 * Decide si una escritura a `filePath` cae dentro de alguno de los
 * `writableRoots`. Resuelve rutas relativas contra `cwd` ANTES de comparar: el
 * agente puede pasar `file_path` relativo a su cwd (no siempre absoluto), y una
 * comparación cruda `startsWith` contra una raíz absoluta lo denegaría por
 * error (bug real 2026-07-19: el análisis de cambio escribía la mini-spec con
 * ruta parcial y toda escritura quedaba denegada). El match es por frontera de
 * segmento (raíz exacta o raíz + "/") para no dejar pasar `/foo-bar` con raíz
 * `/foo`; una raíz que es un archivo (p. ej. schema.prisma) matchea por
 * igualdad exacta. `writableRoots` ausente = guardarraíl desactivado.
 */
export function isWriteAllowed(filePath: string, cwd: string, writableRoots?: string[]): boolean {
  if (!writableRoots) return true;
  const abs = isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
  return writableRoots.some((root) => {
    const absRoot = isAbsolute(root) ? root : resolve(cwd, root);
    return abs === absRoot || abs.startsWith(absRoot.endsWith('/') ? absRoot : `${absRoot}/`);
  });
}

export interface RunAgentOptions {
  /** Instrucción/tarea concreta para este run (contexto del proyecto/spec). */
  prompt: string;
  /** Carpeta raíz sobre la que operan sus herramientas de archivo/shell. */
  cwd: string;
  /** Directorios adicionales fuera de `cwd` a los que puede leer/escribir (p. ej. la carpeta del prototipo fuente). */
  additionalDirectories?: string[];
  systemPrompt?: string;
  model?: string;
  maxTurns?: number;
  /**
   * Prefijos absolutos permitidos para Write/Edit. Si se omite, el guardarraíl
   * de rutas queda desactivado (no usar así en generación — ver
   * generation-runner.service.ts, que SIEMPRE lo pasa).
   */
  writableRoots?: string[];
  /** Filtro adicional sobre comandos Bash concretos (push, sudo, etc.), no sobre rutas — esas ya las scopea `cwd`/`additionalDirectories` del propio SDK. */
  isBashCommandAllowed?: (command: string) => boolean;
}

/**
 * Consumo de un run del agente. Se separa de `AgentRunResult` porque los
 * runners lo persisten también cuando el run FALLA (D-047): hasta entonces un
 * run fallido quedaba con `costUsd: null` y el coste real por proyecto salía
 * subestimado — hueco de instrumentación (a) de D-046.
 */
export interface AgentUsage {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  /**
   * true = la corrida se cortó ANTES del mensaje `result` del SDK (el
   * "Connection closed mid-response" que tiró 23 minutos de generación en
   * D-046). Los tokens son lo acumulado hasta el corte y el coste no lo
   * reporta el SDK: distingue "no gastó" de "no lo sabemos".
   */
  partial?: boolean;
}

export interface AgentRunResult extends AgentUsage {
  success: boolean;
  resultText: string;
  sessionId: string | null;
  turns: number;
  errorMessage?: string;
}

/**
 * Consumo en la forma de las columnas de `Run`, listo para un
 * `prisma.run.update`. Un run sin consumo conocido no escribe nada (deja los
 * campos como estaban) en vez de escribir ceros, que se leerían como "corrió
 * gratis".
 */
export function toUsageFields(usage?: AgentUsage): {
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
} {
  if (!usage) return {};
  if (usage.costUsd <= 0 && usage.inputTokens <= 0 && usage.outputTokens <= 0) return {};
  return { costUsd: usage.costUsd, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };
}

/**
 * Wrapper delgado sobre `query()` del Agent SDK (docs/03-arquitectura.md:
 * "runner de generación... Claude Agent SDK headless"). Aísla al resto del
 * código de la forma exacta del stream de eventos — y es el único punto que
 * los tests mockean (ver analysis-runner.service.spec.ts /
 * generation-runner.service.spec.ts), inyectando esta función completa.
 *
 * Guardarraíl real de escritura: el callback `canUseTool` que le pasamos al
 * SDK (se invoca antes de CADA llamada a una herramienta, sin pausar para un
 * humano — es exactamente el mecanismo pensado para uso headless/desatendido).
 * El `systemPrompt` es solo una instrucción para el modelo, NO un guardarraíl:
 * si el modelo intenta escribir fuera de `writableRoots` de todos modos, es
 * este callback el que deniega la escritura, no el texto del prompt.
 */
export async function runAgent(opts: RunAgentOptions): Promise<AgentRunResult> {
  const canUseTool = async (toolName: string, input: Record<string, unknown>): Promise<LocalPermissionResult> => {
    if (toolName === 'Write' || toolName === 'Edit') {
      const filePath = typeof input.file_path === 'string' ? input.file_path : undefined;
      if (!filePath) {
        return { behavior: 'deny', message: 'file_path ausente en la llamada a la herramienta.' };
      }
      if (!isWriteAllowed(filePath, opts.cwd, opts.writableRoots)) {
        return { behavior: 'deny', message: `Escritura fuera del alcance permitido de este run: ${filePath}` };
      }
      return { behavior: 'allow' };
    }

    if (toolName === 'Bash') {
      const command = typeof input.command === 'string' ? input.command : '';
      if (opts.isBashCommandAllowed && !opts.isBashCommandAllowed(command)) {
        return { behavior: 'deny', message: `Comando no permitido para este run: ${command}` };
      }
      return { behavior: 'allow' };
    }

    return { behavior: 'allow' };
  };

  const query = await loadQuery();
  const stream = query({
    prompt: opts.prompt,
    options: {
      cwd: opts.cwd,
      additionalDirectories: opts.additionalDirectories,
      model: opts.model,
      systemPrompt: opts.systemPrompt,
      maxTurns: opts.maxTurns ?? 40,
      canUseTool
    }
  });

  let resultText = '';
  let sessionId: string | null = null;
  let costUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let turns = 0;
  let success = false;
  let partial = false;
  let errorMessage: string | undefined;
  // Acumulado mensaje a mensaje: si el stream se corta antes del `result`
  // (caso real de D-046, "Connection closed mid-response" a los 23 minutos),
  // esto es lo único que queda del consumo. El `result` final, cuando llega,
  // lo reemplaza por el total autoritativo del SDK.
  let streamedInputTokens = 0;
  let streamedOutputTokens = 0;

  try {
    for await (const message of stream) {
      if (message.type === 'assistant') {
        const usage = (message as { message?: { usage?: { input_tokens?: number; output_tokens?: number } } }).message
          ?.usage;
        streamedInputTokens += usage?.input_tokens ?? 0;
        streamedOutputTokens += usage?.output_tokens ?? 0;
        turns += 1;
      }
      if (message.type === 'result') {
        // SDKResultMessage es `SDKResultSuccess | SDKResultError` — solo
        // `success` trae `result`; `error` (varios subtypes: error_during_execution,
        // error_max_turns, ...) trae `errors: string[]` en su lugar.
        if (message.subtype === 'success') {
          success = !message.is_error;
          resultText = message.result;
          if (!success) {
            errorMessage = message.result;
          }
        } else {
          success = false;
          resultText = message.errors.join('\n');
          errorMessage = resultText || `Run terminado con subtype "${message.subtype}".`;
        }
        sessionId = message.session_id;
        costUsd = message.total_cost_usd;
        inputTokens = message.usage.input_tokens ?? 0;
        outputTokens = message.usage.output_tokens ?? 0;
        turns = message.num_turns;
      }
    }
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  // Sin mensaje `result` (corte a mitad): se reporta lo acumulado del stream y
  // se marca parcial, en vez de devolver ceros que se leerían como "gratis".
  if (inputTokens === 0 && outputTokens === 0 && (streamedInputTokens > 0 || streamedOutputTokens > 0)) {
    inputTokens = streamedInputTokens;
    outputTokens = streamedOutputTokens;
    partial = true;
  }

  return { success, resultText, sessionId, costUsd, inputTokens, outputTokens, turns, partial, errorMessage };
}
