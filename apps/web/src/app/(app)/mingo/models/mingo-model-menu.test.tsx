import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { mingoModelMenu } from './mingo-model-menu';

const currentModel = { provider: 'ANTHROPIC', modelName: 'claude-current', displayName: 'Current Claude' } as const;
const catalog = {
  ANTHROPIC: [{ value: 'claude-current', label: 'Current Claude' }],
  OPENAI: [{ value: 'gpt-current', label: 'Current GPT' }],
  GOOGLE_GEMINI: [{ value: 'gemini-current', label: 'Current Gemini' }],
};

describe('Mingo current-model menu contract', () => {
  it('labels the parent with the effective model when a stored override is retired', () => {
    const [parent] = mingoModelMenu({
      currentModel,
      modelsByProvider: catalog,
      selected: { provider: 'OPENAI', modelName: 'retired-gpt' },
      disabled: false,
      select: vi.fn(),
    });

    expect(parent.label).toBe('Current Claude');
    expect(parent.description).toBe('Chat Model');
    expect(parent.type).toBe('submenu');
    expect(parent.submenu?.find(item => item.id === 'OPENAI')?.submenu).toEqual([
      expect.objectContaining({ label: 'Current GPT', checked: false }),
    ]);
  });

  it('draws the existing provider logos and keeps each supported model under its provider', () => {
    const select = vi.fn().mockResolvedValue(undefined);
    const [parent] = mingoModelMenu({
      currentModel,
      modelsByProvider: catalog,
      selected: null,
      disabled: false,
      select,
    });
    const providers = parent.submenu?.filter(item => item.type === 'submenu') ?? [];

    expect(providers.map(item => item.label)).toEqual(['Anthropic', 'OpenAI', 'Google Gemini']);
    for (const provider of providers) {
      expect(isValidElement(provider.icon)).toBe(true);
      expect(renderToStaticMarkup(<>{provider.icon}</>)).toContain('<svg');
    }
    providers.find(item => item.id === 'OPENAI')?.submenu?.[0].onClick?.();
    expect(select).toHaveBeenCalledWith({ provider: 'OPENAI', modelName: 'gpt-current' });
  });
});
