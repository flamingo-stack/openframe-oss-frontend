/**
 * A Mingo chat's model: a new chat keeps its pick in a draft, a saved chat reads and changes its own, and the composer's model menu
 * is locked while the server would refuse the change.
 */
import type { ActionsMenuItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialogModelState } from './dialog-model-api';
import styles from './mingo-model-change-toast.module.css';
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
  showToast: vi.fn(),
  rateFor: vi.fn(),
  pricingShown: true,
}));

vi.mock('@/app/hooks/use-feature-flag', () => ({ useFeatureFlagGate: () => env.gate }));
vi.mock('@/app/hooks/use-ai-model', () => ({
  useAiModelStatus: () => ({
    aiModel: { provider: 'ANTHROPIC', modelName: 'claude-sonnet-5', displayName: 'Claude Sonnet 5' },
  }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast: env.toast }) }));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => ({
  ...(await importOriginal<object>()),
  showToast: env.showToast,
}));
vi.mock('@/app/(app)/settings/ai-settings/hooks/use-supported-models', () => ({
  useSupportedModels: () => ({
    modelsByProvider: {
      ANTHROPIC: [
        { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
        { value: 'claude-sonnet-5-alt', label: 'Claude Sonnet 5' },
        { value: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
      ],
      OPENAI: [
        { value: 'gpt-5.5', label: 'GPT-5.5' },
        { value: 'gpt-6.1-terra', label: 'GPT-6.1 Terra' },
      ],
    },
  }),
}));
vi.mock('./use-mingo-model-pricing', () => ({
  useMingoModelPricing: () => ({
    shown: env.pricingShown,
    rateFor: env.rateFor,
    usdPerMillionOpenFrameTokens: 10,
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

function Probe({
  chat,
  onSelection,
}: {
  chat: MingoModelChatState;
  onSelection: (value: MingoModelSelection) => void;
}) {
  const next = useMingoModelSelection(chat);
  useEffect(() => {
    onSelection(next);
  });
  return null;
}

async function render(chat: Partial<MingoModelChatState> = {}) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe chat={{ ...IDLE, ...chat }} onSelection={next => (selection = next)} />
      </QueryClientProvider>,
    ),
  );
}

const choice = (id: string, tab = selection): ActionsMenuItem => {
  const items = (tab.menu?.groups ?? []).flatMap(group => group.items);
  const found = items.flatMap(item => [item, ...(item.submenu ?? [])]).find(item => item.id === id);
  if (!found) throw new Error(`no menu item ${id}`);
  return found;
};

beforeEach(() => {
  env.gate = 'on';
  env.fetchDialogModel.mockReset();
  env.updateDialogModel.mockReset();
  env.toast.mockReset();
  env.showToast.mockReset();
  env.rateFor.mockReset();
  env.pricingShown = true;
  useMingoModelDraftStore.setState({ draft: null });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000, refetchOnWindowFocus: false } },
  });
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

    expect(selection.menu).toBeNull();
    expect(selection.current).toBeNull();
    expect(env.fetchDialogModel).not.toHaveBeenCalled();
  });

  it('builds comparison rows in release order with exact-provider pricing and mobile drill-down', async () => {
    env.rateFor.mockImplementation((provider, model) =>
      provider === 'OPENAI' && model === 'gpt-6.1-terra' ? { input: 0.3333, output: 1.6667 } : undefined,
    );
    await render();

    expect(selection.menu?.mobileDrillDown).toBe(true);
    expect(choice('chat-model-ANTHROPIC').submenu?.map(item => item.label)).toEqual([
      'Claude Opus 5.5',
      'Claude Sonnet 5',
      'Claude Sonnet 5',
    ]);
    expect(choice('chat-model-OPENAI').submenu?.map(item => item.label)).toEqual(['GPT-6.1 Terra', 'GPT-5.5']);
    expect(choice('chat-model-OPENAI-gpt-6.1-terra').description).toContain(
      'Recommended. Best for tasks with strict rules. Read and write rates: 0.33× / 1.67×. USD per million: $3.33 / $17.',
    );
    expect(choice('chat-model-OPENAI-gpt-5.5').description).toContain('USD per million: — / —.');
  });

  it('shows no rates or prices in the mobile shell', async () => {
    env.pricingShown = false;
    env.rateFor.mockReturnValue({ input: 1, output: 5 });
    await render();

    expect(choice('chat-model-OPENAI-gpt-5.5').description).toBe('Best for hard, multi-step tasks.');
  });

  it("keeps a new chat's pick in the draft and names it", async () => {
    await render();
    expect(choice('chat-model-default')).toMatchObject({ label: 'Using default model', disabled: true });
    expect(choice('chat-model-ANTHROPIC').checked).toBe(true);

    await act(async () => choice('chat-model-OPENAI-gpt-5.5').onClick?.());
    await render();

    expect(useMingoModelDraftStore.getState().draft).toEqual(GPT);
    expect(selection.current).toEqual(GPT);
    expect(choice('chat-model-OPENAI').checked).toBe(true);
    expect(choice('chat-model-OPENAI-gpt-5.5').checked).toBe(true);
    expect(env.updateDialogModel).not.toHaveBeenCalled();
  });

  it('marks only the default model ID even when two choices share their display name', async () => {
    await render();

    expect(choice('chat-model-default')).toMatchObject({ label: 'Using default model', disabled: true });
    expect(choice('chat-model-ANTHROPIC-claude-sonnet-5').checked).toBe(true);
    expect(choice('chat-model-ANTHROPIC-claude-sonnet-5-alt').checked).toBe(false);
  });

  it("reads a saved chat's model and changes it on the server", async () => {
    const saved: DialogModelState = { model: null, effectiveModel: GPT, modelTokenBudget: 150_000 };
    const updated: DialogModelState = { model: SONNET, effectiveModel: SONNET, modelTokenBudget: 200_000 };
    env.fetchDialogModel.mockResolvedValueOnce(saved).mockResolvedValue(updated);
    env.updateDialogModel.mockResolvedValue(updated);
    await render({ activeDialogId: 'd-1' });
    await vi.waitFor(() => expect(selection.current).toEqual(GPT));

    expect(env.fetchDialogModel).toHaveBeenCalledWith('d-1');
    expect(selection.menu?.disabled).toBe(false);
    expect(selection.contextSize).toBe(150_000);
    expect(choice('chat-model-default')).toMatchObject({ label: 'Using default model', disabled: true });
    expect(choice('chat-model-OPENAI-gpt-5.5').checked).toBe(true);

    await act(async () => choice('chat-model-ANTHROPIC-claude-sonnet-5').onClick?.());
    await vi.waitFor(() => expect(selection.current).toEqual(SONNET));

    expect(env.updateDialogModel).toHaveBeenCalledWith('d-1', SONNET);
    expect(selection.contextSize).toBe(200_000);
    expect(choice('chat-model-ANTHROPIC-claude-sonnet-5').checked).toBe(true);
    expect(env.showToast).toHaveBeenCalledExactlyOnceWith({
      title: 'Chat model changed',
      description: 'Claude Sonnet 5 answers from your next message. Your other chats keep their model.',
      variant: 'success',
      className: styles.modelChangeToast,
    });
  });

  it('puts a saved chat back on the default', async () => {
    env.fetchDialogModel.mockResolvedValue({ model: SONNET, effectiveModel: SONNET, modelTokenBudget: 200_000 });
    env.updateDialogModel.mockResolvedValue({ model: null, effectiveModel: GPT, modelTokenBudget: 150_000 });
    await render({ activeDialogId: 'd-1' });
    await vi.waitFor(() => expect(selection.current).toEqual(SONNET));

    await act(async () => choice('chat-model-default').onClick?.());

    expect(env.updateDialogModel).toHaveBeenCalledWith('d-1', null);
  });

  it('refreshes the same chat in another tab on change and reset without sending a message', async ({
    onTestFinished,
  }) => {
    const defaultState = { model: null, effectiveModel: GPT, modelTokenBudget: 150_000 };
    let saved: DialogModelState = defaultState;
    env.fetchDialogModel.mockImplementation(async (dialogId: string) => (dialogId === 'd-1' ? saved : defaultState));
    env.updateDialogModel.mockImplementation(async (_dialogId, model) => {
      saved = model ? { model, effectiveModel: model, modelTokenBudget: 200_000 } : defaultState;
      return saved;
    });
    const otherTabRoot = createRoot(document.createElement('div'));
    const otherTabClient = new QueryClient();
    onTestFinished(() => {
      act(() => otherTabRoot.unmount());
      otherTabClient.clear();
    });
    let otherTab!: MingoModelSelection;
    let unrelatedChat!: MingoModelSelection;
    await render({ activeDialogId: 'd-1' });
    await act(async () =>
      otherTabRoot.render(
        <QueryClientProvider client={otherTabClient}>
          <Probe chat={{ ...IDLE, activeDialogId: 'd-1' }} onSelection={next => (otherTab = next)} />
          <Probe chat={{ ...IDLE, activeDialogId: 'd-2' }} onSelection={next => (unrelatedChat = next)} />
        </QueryClientProvider>,
      ),
    );
    await vi.waitFor(() => {
      expect(selection.current).toEqual(GPT);
      expect(otherTab.current).toEqual(GPT);
      expect(unrelatedChat.current).toEqual(GPT);
    });

    await act(async () => choice('chat-model-ANTHROPIC-claude-sonnet-5').onClick?.());
    await vi.waitFor(() => expect(otherTab.current).toEqual(SONNET));
    expect(otherTab.contextSize).toBe(200_000);
    expect(choice('chat-model-ANTHROPIC-claude-sonnet-5', otherTab).checked).toBe(true);
    expect(choice('chat-model-default', otherTab)).toMatchObject({ label: 'Use default model', disabled: false });
    expect(env.showToast).toHaveBeenCalledTimes(1);

    await act(async () => choice('chat-model-default', otherTab).onClick?.());
    await vi.waitFor(() => expect(selection.current).toEqual(GPT));
    expect(selection.contextSize).toBe(150_000);
    expect(choice('chat-model-default')).toMatchObject({ label: 'Using default model', disabled: true });
    expect(env.updateDialogModel.mock.calls).toEqual([
      ['d-1', SONNET],
      ['d-1', null],
    ]);
    expect(env.fetchDialogModel.mock.calls.filter(([dialogId]) => dialogId === 'd-2')).toEqual([['d-2']]);
    expect(env.showToast).toHaveBeenCalledTimes(2);
  });

  it('refreshes an open chat on return to the tab even if it missed the change notification', async ({
    onTestFinished,
  }) => {
    env.fetchDialogModel
      .mockResolvedValueOnce({ model: null, effectiveModel: GPT, modelTokenBudget: 150_000 })
      .mockResolvedValue({ model: SONNET, effectiveModel: SONNET, modelTokenBudget: 200_000 });
    focusManager.setFocused(false);
    onTestFinished(() => focusManager.setFocused(undefined));
    await render({ activeDialogId: 'd-1' });
    await vi.waitFor(() => expect(selection.current).toEqual(GPT));

    await act(async () => focusManager.setFocused(true));
    await vi.waitFor(() => expect(selection.current).toEqual(SONNET));
    expect(env.fetchDialogModel.mock.calls).toEqual([['d-1'], ['d-1']]);
    expect(env.updateDialogModel).not.toHaveBeenCalled();
    expect(env.showToast).not.toHaveBeenCalled();
  });

  it('offers reset after a saved model read fails', async () => {
    env.fetchDialogModel.mockRejectedValue(new Error('Temporary network failure'));
    env.updateDialogModel.mockResolvedValue({ model: null, effectiveModel: SONNET, modelTokenBudget: 200_000 });
    await render({ activeDialogId: 'd-1' });
    await vi.waitFor(() => expect(selection.menu?.disabled).toBe(false));

    expect(choice('chat-model-default')).toMatchObject({ label: 'Use default model', disabled: false });
    expect(choice('chat-model-ANTHROPIC').checked).toBe(false);
    expect(choice('chat-model-ANTHROPIC-claude-sonnet-5').checked).toBe(false);
    await act(async () => choice('chat-model-default').onClick?.());
    expect(env.updateDialogModel).toHaveBeenCalledExactlyOnceWith('d-1', null);
    await vi.waitFor(() => expect(env.showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' })));
  });

  it('skips writing and announcing the model that already answers', async () => {
    env.fetchDialogModel.mockResolvedValue({ model: null, effectiveModel: SONNET, modelTokenBudget: 200_000 });
    await render({ activeDialogId: 'd-1' });
    await vi.waitFor(() => expect(selection.current).toEqual(SONNET));

    await act(async () => choice('chat-model-ANTHROPIC-claude-sonnet-5').onClick?.());
    expect(env.updateDialogModel).not.toHaveBeenCalled();
    expect(env.toast).not.toHaveBeenCalled();
    expect(env.showToast).not.toHaveBeenCalled();
  });

  it('says why a change failed', async () => {
    env.fetchDialogModel.mockResolvedValue({ model: null, effectiveModel: GPT, modelTokenBudget: 150_000 });
    env.updateDialogModel.mockRejectedValue(new Error('Chat state changed. Reload it before changing the model.'));
    await render({ activeDialogId: 'd-1' });
    await vi.waitFor(() => expect(selection.current).toEqual(GPT));

    await act(async () => choice('chat-model-ANTHROPIC-claude-sonnet-5').onClick?.());

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

    expect(selection.menu?.disabled).toBe(true);
  });
});
