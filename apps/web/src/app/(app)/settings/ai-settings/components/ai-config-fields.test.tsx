'use no memo';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useForm, useWatch } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupportedModelsByProvider } from '../hooks/use-supported-models';
import { type AiLogicFormValues, toAgentAiConfigInput } from '../types/ai-logic.types';
import { AiProviderModelFields } from './ai-config-fields';

const geminiModel = 'gemini-3.1-pro-preview';
const models: SupportedModelsByProvider = {
  ANTHROPIC: [{ value: 'claude-opus-5-5', label: 'Claude Opus 5.5' }],
  OPENAI: [{ value: 'gpt-6.1-terra', label: 'GPT-6.1 Terra' }],
};
const modelsWithGemini: SupportedModelsByProvider = {
  ...models,
  GOOGLE_GEMINI: [{ value: geminiModel, label: 'Gemini 3.1 Pro Preview' }],
};

function Harness({
  currentProvider,
  currentModel,
  catalog,
  onSave,
}: {
  currentProvider: AiLogicFormValues['llmProvider'];
  currentModel: string;
  catalog: SupportedModelsByProvider | undefined;
  onSave: (values: ReturnType<typeof toAgentAiConfigInput>) => void;
}) {
  const { control, handleSubmit, setValue } = useForm<AiLogicFormValues>({
    defaultValues: {
      llmProvider: currentProvider,
      providerModel: currentModel,
      answerStyle: 'STANDARD',
      quickActionsIsDefault: true,
      quickActions: [],
    },
  });
  const llmProvider = useWatch({ control, name: 'llmProvider' });

  return (
    <form onSubmit={handleSubmit(values => onSave(toAgentAiConfigInput(values)))}>
      <AiProviderModelFields
        control={control}
        llmProvider={llmProvider}
        modelsByProvider={catalog}
        onProviderChange={() => setValue('providerModel', '')}
      />
      <button type="button" onClick={() => setValue('answerStyle', 'SHORT')}>
        Short answers
      </button>
      <button type="submit">Save</button>
    </form>
  );
}

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('AiProviderModelFields', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(
    catalog: SupportedModelsByProvider | undefined,
    currentProvider: AiLogicFormValues['llmProvider'],
    currentModel: string,
  ) {
    const onSave = vi.fn();
    act(() => root.render(<Harness {...{ catalog, currentProvider, currentModel, onSave }} />));
    const [provider, model] = container.querySelectorAll<HTMLButtonElement>('button[role="combobox"]');
    expect(provider).toBeDefined();
    expect(model).toBeDefined();
    return { provider, model, onSave };
  }

  function open(trigger: HTMLButtonElement) {
    act(() => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
  }

  async function save() {
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click());
  }

  /** The provider's mark in a select trigger; the trigger's chevron is the aria-hidden svg. */
  function markOf(trigger: HTMLButtonElement) {
    return trigger.querySelector('svg:not([aria-hidden="true"])');
  }

  it.each([
    { catalog: models, state: 'missing' },
    { catalog: { ...models, GOOGLE_GEMINI: [] }, state: 'empty' },
  ])('offers Anthropic and OpenAI when the Gemini catalog is $state', async ({ catalog }) => {
    const { provider, model, onSave } = render(catalog, 'ANTHROPIC', 'claude-opus-5-5');

    expect(provider.textContent).toBe('Anthropic');
    expect(markOf(provider)).not.toBeNull();
    expect(model.textContent).toBe('Claude Opus 5.5');
    const options = open(provider);
    expect(options.map(option => option.textContent)).toEqual(['Anthropic', 'OpenAI']);

    act(() => options[1].click());
    expect(provider.textContent).toBe('OpenAI');
    expect(markOf(provider)).not.toBeNull();
    expect(model.textContent).toBe('Select a model');
    const modelOptions = open(model);
    expect(modelOptions.map(option => option.textContent)).toEqual(['GPT-6.1 Terra']);

    act(() => modelOptions[0].click());
    await save();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ llmProvider: 'OPENAI', providerModel: 'gpt-6.1-terra' }),
    );
  });

  it('offers a provider when the backend still advertises its models', () => {
    const { provider, model } = render(modelsWithGemini, 'ANTHROPIC', 'claude-opus-5-5');
    const options = open(provider);
    expect(options.map(option => option.textContent)).toEqual(['Anthropic', 'OpenAI', 'Google Gemini']);

    act(() => options[2].click());
    expect(open(model).map(option => option.textContent)).toEqual(['Gemini 3.1 Pro Preview']);
  });

  it('preserves a saved Gemini selection that is missing from the catalog', async () => {
    const { provider, model, onSave } = render(models, 'GOOGLE_GEMINI', geminiModel);

    expect(provider.textContent).toBe('Google Gemini');
    expect(markOf(provider)).not.toBeNull();
    expect(model.textContent).toBe(geminiModel);
    expect(model.disabled).toBe(true);

    act(() => container.querySelector<HTMLButtonElement>('button[type="button"]:not([role])')?.click());
    await save();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ llmProvider: 'GOOGLE_GEMINI', providerModel: geminiModel, answerStyle: 'SHORT' }),
    );

    const options = open(provider);
    expect(options.map(option => option.textContent)).toEqual(['Anthropic', 'OpenAI']);
    act(() => options[0].click());
    expect(model.disabled).toBe(false);
    expect(open(model).map(option => option.textContent)).toEqual(['Claude Opus 5.5']);
  });

  it.each([
    { catalog: undefined, state: 'loading' },
    { catalog: {}, state: 'empty' },
  ])('keeps the saved configuration visible and locked while the catalog is $state', ({ catalog }) => {
    const { provider, model, onSave } = render(catalog, 'ANTHROPIC', 'claude-opus-5-5');

    expect(provider.disabled).toBe(true);
    expect(provider.textContent).toBe('Anthropic');
    expect(markOf(provider)).not.toBeNull();
    expect(model.disabled).toBe(true);
    expect(model.textContent).toBe('claude-opus-5-5');

    act(() =>
      root.render(
        <Harness catalog={models} currentProvider="ANTHROPIC" currentModel="claude-opus-5-5" onSave={onSave} />,
      ),
    );
    expect(provider.disabled).toBe(false);
    expect(model.disabled).toBe(false);
    expect(model.textContent).toBe('Claude Opus 5.5');
  });
});
