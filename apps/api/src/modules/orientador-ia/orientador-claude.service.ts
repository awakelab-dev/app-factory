import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ORIENTADOR_SECTORS, orientadorLevelSchema, orientadorSectorSchema } from '@awk/types';
import type { OrientadorInputType, OrientadorLevel, OrientadorSector } from '@awk/types';

// Modelo confirmado en el gate spec (D-025): Haiku — la tarea es clasificación
// + resumen estructurado sobre texto corto (≤2000 caracteres), no razonamiento
// complejo. Configurable por si hiciera falta subir a Sonnet más adelante sin
// tocar código.
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const ANALYSIS_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 512;

export interface ClaudeAnalysisInput {
  rawInputType: OrientadorInputType;
  rawInputText: string;
  declaredSector?: OrientadorSector;
  declaredLevel?: OrientadorLevel;
}

export interface ClaudeAnalysisResult {
  recommendedSector: OrientadorSector;
  rationale: string;
  estimatedLevel: OrientadorLevel;
  skillGaps: string[];
  model: string;
  tokensUsed?: number;
}

/**
 * Cliente de la API de Claude (Messages API) para el análisis de orientador-ia
 * (D-025): reemplaza el motor de keyword-matching del prototipo original.
 * Usa `fetch` nativo (mismo criterio que moodle-client.service.ts: no añade
 * una dependencia HTTP/SDK nueva al monorepo por una sola llamada estructurada
 * por candidato). UNA llamada por análisis, no chat multi-turno (spec técnica,
 * "Integración con Claude API").
 */
@Injectable()
export class OrientadorClaudeService {
  /** false si falta la API key — el intake service debe comprobarlo antes de analizar. */
  get isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async analyze(input: ClaudeAnalysisInput): Promise<ClaudeAnalysisResult> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'ANTHROPIC_API_KEY no configurada — orientador-ia no puede analizar perfiles (ver .env.example).'
      );
    }

    const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
    const prompt = buildPrompt(input);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS)
    });

    if (!res.ok) {
      throw new Error(`Claude respondió HTTP ${res.status} analizando el perfil`);
    }

    const body = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const text = body.content.find((block) => block.type === 'text')?.text;
    if (!text) throw new Error('Claude no devolvió texto en la respuesta');

    const parsed = parseAnalysis(text, input);
    return {
      ...parsed,
      model,
      tokensUsed: body.usage ? body.usage.input_tokens + body.usage.output_tokens : undefined
    };
  }
}

function buildPrompt(input: ClaudeAnalysisInput): string {
  return `Eres un orientador de carrera para el mercado laboral español. Analiza la siguiente información de un candidato y responde ÚNICAMENTE con un objeto JSON (sin markdown, sin texto adicional) con esta forma exacta:

{
  "recommendedSector": uno de [${ORIENTADOR_SECTORS.join(', ')}],
  "rationale": "justificación breve (2-3 frases) de por qué ese sector encaja con el candidato",
  "estimatedLevel": uno de ["inicial", "aplicada", "experto"],
  "skillGaps": ["hueco de formación 1", "hueco de formación 2", "hueco de formación 3 (opcional)"]
}

Tipo de información aportada: ${input.rawInputType}
Sector declarado por el candidato (puede ser útil pero no es vinculante): ${input.declaredSector ?? 'no declarado'}
Nivel declarado por el candidato: ${input.declaredLevel ?? 'no declarado'}

Información del candidato:
"""
${input.rawInputText}
"""`;
}

/** Valida la salida de Claude contra los enums reales — nunca confiar en texto libre de un LLM sin parsear. */
function parseAnalysis(
  text: string,
  input: ClaudeAnalysisInput
): Pick<ClaudeAnalysisResult, 'recommendedSector' | 'rationale' | 'estimatedLevel' | 'skillGaps'> {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('La respuesta de Claude no contiene un JSON reconocible');

  let raw: unknown;
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('La respuesta de Claude no es un JSON válido');
  }

  const obj = raw as Record<string, unknown>;
  const sectorResult = orientadorSectorSchema.safeParse(obj.recommendedSector);
  const levelResult = orientadorLevelSchema.safeParse(obj.estimatedLevel);

  return {
    // Si Claude devuelve un sector fuera del catálogo, degradamos al sector
    // declarado por el candidato (si lo hay) antes de fallar la request entera.
    recommendedSector: sectorResult.success
      ? sectorResult.data
      : (input.declaredSector ?? throwUnrecognized('recommendedSector', obj.recommendedSector)),
    rationale: typeof obj.rationale === 'string' ? obj.rationale : 'Sin justificación disponible.',
    estimatedLevel: levelResult.success ? levelResult.data : (input.declaredLevel ?? 'inicial'),
    skillGaps: Array.isArray(obj.skillGaps) ? obj.skillGaps.filter((s): s is string => typeof s === 'string') : []
  };
}

function throwUnrecognized(field: string, value: unknown): never {
  throw new Error(`Claude devolvió un valor no reconocido en "${field}": ${JSON.stringify(value)}`);
}
