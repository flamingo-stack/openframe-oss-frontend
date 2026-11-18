import type { ChatMessage } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useLayoutEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import type { DialogModelInput, MingoModelRecord } from './mingo-model.types';
import { useMingoModelSelection } from './use-mingo-model-selection';

const { read, update, toast } = vi.hoisted(() => ({ read: vi.fn(), update: vi.fn(), toast: vi.fn() }));
vi.mock('./mingo-model-api-service', () => ({ readDialogModel: read, updateDialogModel: update }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/app/hooks/use-ai-model', () => ({
  useAiModelStatus: () => ({
    aiModel: { provider: 'ANTHROPIC', modelName: 'claude-default', displayName: 'Default Claude' },
  }),
}));
vi.mock('@/app/(app)/settings/ai-settings/hooks/use-supported-models', () => ({
  useSupportedModels: () => ({
    modelsByProvider: {
      ANTHROPIC: [{ value: 'claude-default', label: 'Default Claude' }],
      OPENAI: [{ value: 'gpt-test', label: 'GPT Test' }],
    },
    isLoading: false,
  }),
}));

const CLAUDE = { provider: 'ANTHROPIC', modelName: 'claude-default', displayName: 'Default Claude' } as const;
const GPT = { provider: 'OPENAI', modelName: 'gpt-test', displayName: 'GPT Test' } as const;
const record = (overrides: Partial<MingoModelRecord> = {}): MingoModelRecord => ({
  id: 'relay-a',
  dialogId: 'a',
  agentType: 'ADMIN',
  contextSize: 200_000,
  model: null,
  effectiveModel: CLAUDE,
  status: 'ACTIVE',
  streamState: 'IDLE',
  pendingApproval: null,
  ...overrides,
});
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
let activeDialogId: string | null;
let streamingPhase: 'idle' | 'thinking';
let messages: ChatMessage[];
let compacting: boolean;
let seen: ReturnType<typeof useMingoModelSelection>;

function Probe() {
  const [draftModel, onDraftChange] = useState<DialogModelInput | null>(null);
  const selection = useMingoModelSelection(
    { activeDialogId, streamingPhase, messages, isCompacting: compacting, isLoading: false, activeDialog: null },
    { draftModel, onDraftChange },
  );
  useLayoutEffect(() => {
    seen = selection;
  });
  return null;
}
async function render() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    await new Promise(resolve => setTimeout(resolve, 5));
  });
}
async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue(record());
  update.mockImplementation(async (_id: string, model: DialogModelInput | null) =>
    record({ model: model ? GPT : null, effectiveModel: model ? GPT : CLAUDE, contextSize: model ? 150_000 : 200_000 }),
  );
  useFeatureFlagsStore.setState({ flags: { 'ai-mingo-chat-model-selection': true }, isLoaded: true });
  activeDialogId = null;
  streamingPhase = 'idle';
  messages = [];
  compacting = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  client.clear();
  container.remove();
  useFeatureFlagsStore.getState().reset();
});

describe('Mingo per-chat model selection', () => {
  it.each([false, undefined])('does not ask an older backend for new fields when the flag is %s', async enabled => {
    useFeatureFlagsStore.setState({
      flags: enabled === undefined ? {} : { 'ai-mingo-chat-model-selection': enabled },
      isLoaded: true,
    });
    activeDialogId = 'a';
    await render();
    expect(seen.gate).toBe('off');
    expect(seen.menuItems).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });
  it('shows neither version of the selection controls while the flag loads', async () => {
    useFeatureFlagsStore.setState({ flags: {}, isLoaded: false });
    await render();
    expect(seen.gate).toBe('loading');
    expect(seen.menuItems).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });
  it('keeps a draft selection local until its chat is created and does not reuse it in another chat', async () => {
    await render();
    await act(async () => {
      await seen.selectModel(GPT);
    });
    expect(update).not.toHaveBeenCalled();
    expect(seen.effectiveModel).toEqual(GPT);
    activeDialogId = 'a';
    await render();
    await settle();
    expect(seen.effectiveModel).toEqual(CLAUDE);
    activeDialogId = null;
    await render();
    expect(seen.effectiveModel).toEqual(CLAUDE);
  });
  it('hydrates the saved selection, updates only the active dialog and resets explicitly to its default', async () => {
    activeDialogId = 'a';
    read.mockResolvedValue(record({ model: GPT, effectiveModel: GPT }));
    await render();
    await settle();
    expect(seen.effectiveModel).toEqual(GPT);
    await act(async () => {
      await seen.selectModel(null);
    });
    expect(update).toHaveBeenCalledWith('relay-a', null);
    await settle();
    expect(seen.effectiveModel).toEqual(CLAUDE);
    expect(seen.contextSize).toBe(200_000);
    expect(seen.menuItems[0].submenu?.[0].checked).toBe(true);
  });
  it('preserves the displayed selection when a mutation fails and reports the backend reason', async () => {
    activeDialogId = 'a';
    await render();
    await settle();
    update.mockRejectedValue(new Error('The chat is being processed'));
    await act(async () => {
      await seen.selectModel(GPT);
    });
    expect(seen.effectiveModel).toEqual(CLAUDE);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'The chat is being processed', variant: 'destructive' }),
    );
  });
  it.each([
    { agentType: 'CLIENT' },
    { status: 'ARCHIVED' },
    { status: 'RESOLVED' },
    { streamState: 'STREAMING' },
    { pendingApproval: { id: 'approval-a' } },
  ] satisfies Partial<MingoModelRecord>[])('disables selection for a backend-protected state %j', async state => {
    activeDialogId = 'a';
    read.mockResolvedValue(record(state));
    await render();
    await settle();
    expect(seen.disabled).toBe(true);
    await act(async () => {
      await seen.selectModel(GPT);
    });
    expect(update).not.toHaveBeenCalled();
  });
  it('disables selection immediately while the engine is writing, before the next backend poll', async () => {
    activeDialogId = 'a';
    streamingPhase = 'thinking';
    await render();
    await settle();
    expect(seen.disabled).toBe(true);
    expect(seen.menuItems[0].disabled).toBe(true);
    expect(seen.menuItems[0].submenu?.every(item => item.disabled)).toBe(true);
  });
  it('disables selection immediately for a pending approval in the live thread', async () => {
    activeDialogId = 'a';
    messages = [
      {
        id: 'reply',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'read_note',
            toolCallId: 'call-a',
            state: 'approval-requested',
            input: {},
            approval: { id: 'approval-a' },
          },
        ],
      },
    ];
    await render();
    await settle();
    expect(seen.disabled).toBe(true);
    await act(async () => {
      await seen.selectModel(GPT);
    });
    expect(update).not.toHaveBeenCalled();
  });
  it('disables model changes while local compaction is running', async () => {
    compacting = true;
    await render();
    expect(seen.disabled).toBe(true);
  });
  it('shows unavailable on an incompatible backend instead of claiming the tenant default is selected', async () => {
    activeDialogId = 'a';
    read.mockRejectedValue(new Error('Cannot query field effectiveModel'));
    await render();
    await settle();
    expect(seen.unavailable).toBe(true);
    expect(seen.effectiveModel).toBeNull();
    expect(seen.disabled).toBe(true);
  });
});
