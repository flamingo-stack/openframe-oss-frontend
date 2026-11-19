/**
 * A Mingo chat's model: a new chat keeps its pick in a draft, a saved chat reads and changes its own, and the ⋯ entry
 * is locked while the server would refuse the change.
 */
import type { ActionsMenuItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
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
vi.mock('@/app/hooks/use-ai-model', () => ({
  useAiModelStatus: () => ({ aiModel: { provider: 'ANTHROPIC', displayName: 'Claude Opus 5.5' } }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast: env.toast }) }));
vi.mock('@/app/(app)/settings/ai-settings/hooks/use-supported-models', () => ({
  useSupportedModels: () => ({
    modelsByProvider: {
      ANTHROPIC: [{ value: 'claude-sonnet-5', label: 'Claude Sonnet 5' }],
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
  messages: [],
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

const entry = () => selection.menuItems[0];
const choice = (id: string): ActionsMenuItem => {
  const all = (entry().submenu ?? []).flatMap(item => [item, ...(item.submenu ?? [])]);
  const found = all.find(item => item.id === id);
  if (!found) throw new Error(`no menu item ${id}`);
  return found;
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

    expect(selection.menuItems).toEqual([]);
    expect(selection.current).toBeNull();
    expect(env.fetchDialogModel).not.toHaveBeenCalled();
  });

  it("keeps a new chat's pick in the draft and names it", async () => {
    await render();
    expect(choice('chat-model-default').checked).toBe(true);
    expect(entry()).toMatchObject({ label: 'Claude Opus 5.5', description: 'Chat Model' });

    await act(async () => choice('chat-model-OPENAI-gpt-5.5').onClick?.());
    await render();

    expect(useMingoModelDraftStore.getState().draft).toEqual(GPT);
    expect(selection.current).toEqual(GPT);
    expect(entry().label).toBe('GPT-5.5');
    expect(choice('chat-model-OPENAI-gpt-5.5').checked).toBe(true);
    expect(env.updateDialogModel).not.toHaveBeenCalled();
  });

  it("reads a saved chat's model and changes it on the server", async () => {
    const saved: DialogModelState = { model: null, effectiveModel: GPT, modelTokenBudget: 150_000 };
    env.fetchDialogModel.mockResolvedValue(saved);
    env.updateDialogModel.mockResolvedValue({ model: SONNET, effectiveModel: SONNET, modelTokenBudget: 200_000 });
    await render({ activeDialogId: 'd-1' });
    await vi.waitFor(() => expect(selection.current).toEqual(GPT));

    expect(env.fetchDialogModel).toHaveBeenCalledWith('d-1');
    expect(selection.contextSize).toBe(150_000);
    expect(choice('chat-model-default').checked).toBe(true);

    await act(async () => choice('chat-model-ANTHROPIC-claude-sonnet-5').onClick?.());
    await vi.waitFor(() => expect(selection.current).toEqual(SONNET));

    expect(env.updateDialogModel).toHaveBeenCalledWith('d-1', SONNET);
    expect(selection.contextSize).toBe(200_000);
    expect(choice('chat-model-ANTHROPIC-claude-sonnet-5').checked).toBe(true);
  });

  it('puts a saved chat back on the default', async () => {
    env.fetchDialogModel.mockResolvedValue({ model: SONNET, effectiveModel: SONNET, modelTokenBudget: 200_000 });
    env.updateDialogModel.mockResolvedValue({ model: null, effectiveModel: GPT, modelTokenBudget: 150_000 });
    await render({ activeDialogId: 'd-1' });
    await vi.waitFor(() => expect(selection.current).toEqual(SONNET));

    await act(async () => choice('chat-model-default').onClick?.());

    expect(env.updateDialogModel).toHaveBeenCalledWith('d-1', null);
  });

  it('says why a change failed', async () => {
    env.fetchDialogModel.mockResolvedValue({ model: null, effectiveModel: GPT, modelTokenBudget: 150_000 });
    env.updateDialogModel.mockRejectedValue(new Error('This chat is waiting for an approval'));
    await render({ activeDialogId: 'd-1' });
    await vi.waitFor(() => expect(selection.current).toEqual(GPT));

    await act(async () => choice('chat-model-ANTHROPIC-claude-sonnet-5').onClick?.());

    await vi.waitFor(() =>
      expect(env.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'This chat is waiting for an approval', variant: 'destructive' }),
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

    expect(entry().disabled).toBe(true);
  });
});
