/**
 * A Mingo chat's model: a new chat keeps its pick in a draft, a saved chat reads and changes its own, and the composer picker
 * is locked while the server would refuse the change.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialogModelState } from './dialog-model-api';
import { useMingoModelDraftStore } from './mingo-model-draft-store';
import {
  type MingoModelChatState,
  type MingoModelSelection,
  useMingoModelSelection,
} from './use-mingo-model-selection';

const env = vi.hoisted(() => ({
  gate: 'on' as 'on' | 'off' | 'loading',
  fetchDialogModel: vi.fn(),
  updateDialogModel: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/app/hooks/use-feature-flag', () => ({ useFeatureFlagGate: () => env.gate }));
vi.mock('@/app/(app)/settings/ai-settings/hooks/use-agent-ai-config', () => ({
  useAdminAiConfig: () => ({ config: { llmProvider: 'ANTHROPIC', providerModel: 'claude-sonnet-5' } }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast: env.toast }) }));
vi.mock('@/app/(app)/settings/ai-settings/hooks/use-supported-models', () => ({
  useSupportedModels: () => ({
    modelsByProvider: {
      ANTHROPIC: [
        { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
        { value: 'claude-sonnet-5-alt', label: 'Claude Sonnet 5' },
      ],
      OPENAI: [{ value: 'gpt-5.5', label: 'GPT-5.5' }],
    },
  }),
}));
vi.mock('./dialog-model-api', async importOriginal => ({
  ...(await importOriginal<object>()),
  fetchDialogModel: env.fetchDialogModel,
  updateDialogModel: env.updateDialogModel,
}));

const GPT = { provider: 'OPENAI' as const, modelName: 'gpt-5.5', displayName: 'GPT-5.5' };
const SONNET = { provider: 'ANTHROPIC' as const, modelName: 'claude-sonnet-5', displayName: 'Claude Sonnet 5' };
const IDLE: MingoModelChatState = {
  activeDialogId: null,
  streamingPhase: 'idle',
  archived: false,
  isCompacting: false,
};

let selection: MingoModelSelection;
let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

function Probe({ chat }: { chat: MingoModelChatState }) {
  const next = useMingoModelSelection(chat);
  useEffect(() => {
    selection = next;
  });
  return null;
}

async function render(chat: Partial<MingoModelChatState> = {}) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe chat={{ ...IDLE, ...chat }} />
      </QueryClientProvider>,
    ),
  );
}

const modelOption = (id: string) => {
  const model = selection.picker?.providers.flatMap(provider => provider.models).find(option => option.id === id);
  if (!model) throw new Error('no model option ' + id);
  return model;
};

beforeEach(() => {
  env.gate = 'on';
  env.fetchDialogModel.mockReset();
  env.updateDialogModel.mockReset();
  env.toast.mockReset();
  useMingoModelDraftStore.setState({ draft: null });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useMingoModelSelection', () => {
  it('offers nothing and reads nothing while the flag is off', async () => {
    env.gate = 'off';
    await render({ activeDialogId: 'd-1' });

    expect(selection.picker).toBeNull();
    expect(selection.current).toBeNull();
    expect(env.fetchDialogModel).not.toHaveBeenCalled();
  });

  it("keeps a new chat's pick in the draft and names it", async () => {
    await render();
    expect(selection.picker?.followsDefault).toBe(true);
    expect(selection.picker?.providers[0]).toMatchObject({ provider: 'ANTHROPIC', current: true });

    await act(async () => modelOption('gpt-5.5').choose());
    await render();

    expect(useMingoModelDraftStore.getState().draft).toEqual(GPT);
    expect(selection.current).toEqual(GPT);
    expect(selection.picker?.providers[1]).toMatchObject({ provider: 'OPENAI', current: true });
    expect(modelOption('gpt-5.5').current).toBe(true);
    expect(env.updateDialogModel).not.toHaveBeenCalled();
  });

  it('marks only the default model ID even when two choices share their display name', async () => {
    await render();

    expect(selection.picker?.followsDefault).toBe(true);
    expect(modelOption('claude-sonnet-5').current).toBe(true);
    expect(modelOption('claude-sonnet-5-alt').current).toBe(false);
  });

  it("reads a saved chat's model and changes it on the server", async () => {
    const saved: DialogModelState = { model: null, effectiveModel: GPT, modelTokenBudget: 150_000 };
    env.fetchDialogModel.mockResolvedValue(saved);
    env.updateDialogModel.mockResolvedValue({ model: SONNET, effectiveModel: SONNET, modelTokenBudget: 200_000 });
    await render({ activeDialogId: 'd-1' });
    await vi.waitFor(() => expect(selection.current).toEqual(GPT));

    expect(env.fetchDialogModel).toHaveBeenCalledWith('d-1');
    expect(selection.picker?.disabled).toBe(false);
    expect(selection.contextSize).toBe(150_000);
    expect(selection.picker?.followsDefault).toBe(true);
    expect(modelOption('gpt-5.5').current).toBe(true);

    await act(async () => modelOption('claude-sonnet-5').choose());
    await vi.waitFor(() => expect(selection.current).toEqual(SONNET));

    expect(env.updateDialogModel).toHaveBeenCalledWith('d-1', SONNET);
    expect(selection.contextSize).toBe(200_000);
    expect(modelOption('claude-sonnet-5').current).toBe(true);
  });

  it('puts a saved chat back on the default', async () => {
    env.fetchDialogModel.mockResolvedValue({ model: SONNET, effectiveModel: SONNET, modelTokenBudget: 200_000 });
    env.updateDialogModel.mockResolvedValue({ model: null, effectiveModel: GPT, modelTokenBudget: 150_000 });
    await render({ activeDialogId: 'd-1' });
    await vi.waitFor(() => expect(selection.current).toEqual(SONNET));

    await act(async () => selection.picker?.chooseDefault());

    expect(env.updateDialogModel).toHaveBeenCalledWith('d-1', null);
  });

  it('says why a change failed', async () => {
    env.fetchDialogModel.mockResolvedValue({ model: null, effectiveModel: GPT, modelTokenBudget: 150_000 });
    env.updateDialogModel.mockRejectedValue(new Error('Chat state changed. Reload it before changing the model.'));
    await render({ activeDialogId: 'd-1' });
    await vi.waitFor(() => expect(selection.current).toEqual(GPT));

    await act(async () => modelOption('claude-sonnet-5').choose());

    await vi.waitFor(() =>
      expect(env.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Chat state changed. Reload it before changing the model.',
          variant: 'destructive',
        }),
      ),
    );
  });

  it.each([
    ['mid-reply', { streamingPhase: 'streaming' }],
    ['archived', { archived: true }],
    ['compacting', { isCompacting: true }],
  ])('locks the entry while the chat is %s', async (_, chat) => {
    env.fetchDialogModel.mockResolvedValue({ model: null, effectiveModel: GPT, modelTokenBudget: 150_000 });
    await render({ activeDialogId: 'd-1', ...chat });
    await vi.waitFor(() => expect(selection.current).toEqual(GPT));

    expect(selection.picker?.disabled).toBe(true);
  });
});
