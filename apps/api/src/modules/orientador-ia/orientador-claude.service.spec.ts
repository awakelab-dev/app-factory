import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrientadorClaudeService } from './orientador-claude.service';

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function claudeTextResponse(json: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(json) }], usage: { input_tokens: 100, output_tokens: 40 } };
}

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('OrientadorClaudeService.isConfigured', () => {
  it('false si falta ANTHROPIC_API_KEY', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(new OrientadorClaudeService().isConfigured).toBe(false);
  });

  it('true con la variable presente', () => {
    expect(new OrientadorClaudeService().isConfigured).toBe(true);
  });
});

describe('OrientadorClaudeService.analyze', () => {
  it('parsea una respuesta válida de Claude', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        ok(
          claudeTextResponse({
            recommendedSector: 'desarrollo',
            rationale: 'Tiene experiencia previa programando.',
            estimatedLevel: 'aplicada',
            skillGaps: ['Testing automatizado', 'Arquitectura de sistemas']
          })
        )
      )
    );

    const result = await new OrientadorClaudeService().analyze({
      rawInputType: 'story',
      rawInputText: 'Llevo 3 años programando en JavaScript...'
    });

    expect(result.recommendedSector).toBe('desarrollo');
    expect(result.estimatedLevel).toBe('aplicada');
    expect(result.skillGaps).toHaveLength(2);
    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(result.tokensUsed).toBe(140);
  });

  it('degrada al sector declarado si Claude devuelve un sector fuera del catálogo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        ok(
          claudeTextResponse({
            recommendedSector: 'sector-inventado',
            rationale: 'texto',
            estimatedLevel: 'inicial',
            skillGaps: []
          })
        )
      )
    );

    const result = await new OrientadorClaudeService().analyze({
      rawInputType: 'story',
      rawInputText: 'texto libre',
      declaredSector: 'marketing'
    });

    expect(result.recommendedSector).toBe('marketing');
  });

  it('sin ANTHROPIC_API_KEY lanza ServiceUnavailableException sin llamar a fetch', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new OrientadorClaudeService().analyze({ rawInputType: 'story', rawInputText: 'x' })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propaga error si la respuesta HTTP no es ok', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500 })));
    await expect(
      new OrientadorClaudeService().analyze({ rawInputType: 'story', rawInputText: 'x' })
    ).rejects.toThrow('HTTP 500');
  });

  it('falla si la respuesta no contiene JSON reconocible', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok({ content: [{ type: 'text', text: 'no soy json' }] })));
    await expect(
      new OrientadorClaudeService().analyze({ rawInputType: 'story', rawInputText: 'x' })
    ).rejects.toThrow('JSON reconocible');
  });
});
