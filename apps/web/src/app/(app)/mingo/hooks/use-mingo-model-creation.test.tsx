import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import type { DialogModelInput } from '../models/mingo-model.types';
import { type MingoUnifiedChat, useMingoUnifiedChatState } from './use-mingo-unified-chat-state';

const { create, toast } = vi.hoisted(() => ({ create: vi.fn(), toast: vi.fn() }));
vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', async importOriginal => ({
  ...(await importOriginal<object>()),
  createMingoGraphqlDialogs: () => ({
    fetchDialogs: async () => ({ dialogs: [], nextCursor: null }),
    fetchDialog: async () => null,
  }),
  createMingoGraphqlHistory: () => async () => ({ messages: [], nextCursor: null }),
  jetStreamLiveTail: () => () => undefined,
  useSlashCommandRegistry: () => ({ commands: [] }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/contexts', () => ({ useChatRuntime: () => ({ endpoints: {} }) }));
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
vi.mock('../models/mingo-model-api-service', () => ({
  readDialogModel: async () => ({
    id: 'created-chat',
    dialogId: 'created-chat',
    agentType: 'ADMIN',
    status: 'ACTIVE',
    streamState: 'IDLE',
    pendingApproval: null,
    model: { provider: 'OPENAI', modelName: 'gpt-test', displayName: 'GPT Test' },
    effectiveModel: { provider: 'OPENAI', modelName: 'gpt-test', displayName: 'GPT Test' },
    contextSize: 150_000,
  }),
}));
vi.mock('@/lib/nats/nats-app-config', () => ({ useNatsAppConfig: () => ({ getWsUrl: () => 'wss://nats.test' }) }));
vi.mock('@/app/(app)/tickets/services', () => ({
  ticketService: { createDialog: create, sendMessage: async () => {} },
}));
vi.mock('@/lib/analytics', () => ({ EVENT_SUBTYPE: {}, trackDashboardActivity: () => {} }));
vi.mock('./use-mingo-dialog-row-status', () => ({ useMingoDialogRowStatus: () => () => undefined }));

let root: Root;
let client: QueryClient;
let seen: MingoUnifiedChat;
const MODEL: DialogModelInput = { provider: 'OPENAI', modelName: 'gpt-test' };
const DEFAULT_MODEL: DialogModelInput = { provider: 'ANTHROPIC', modelName: 'claude-default' };
function Probe({ page = 'home' }: { page?: string }) {
  const chat = useMingoUnifiedChatState({ onScreen: false });
  useLayoutEffect(() => {
    seen = chat;
  });
  return (
    <div>
      {page}: {chat.state.currentModelLabel}
    </div>
  );
}
beforeEach(async () => {
  vi.clearAllMocks();
  useFeatureFlagsStore.setState({ flags: { 'ai-mingo-chat-model-selection': true }, isLoaded: true });
  create.mockResolvedValue('created-chat');
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root = createRoot(document.createElement('div'));
  await render();
});
afterEach(() => {
  act(() => root.unmount());
  client.clear();
  vi.restoreAllMocks();
  useFeatureFlagsStore.getState().reset();
});
async function render(page = 'home') {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe page={page} />
      </QueryClientProvider>,
    ),
  );
}
async function chooseDraft() {
  await act(async () => {
    await seen.modelSelection?.selectModel(MODEL);
  });
}
function newDraft() {
  seen.state.selectDialog(null);
  seen.state.clearMessages();
}
function holdCreation() {
  let resolve!: (id: string) => void;
  let reject!: (error: Error) => void;
  create.mockImplementationOnce(
    () =>
      new Promise<string>((yes, no) => {
        resolve = yes;
        reject = no;
      }),
  );
  return { resolve: (id: string) => resolve(id), reject: (error: Error) => reject(error) };
}

describe('Mingo draft model lifecycle with the production chat engine', () => {
  it('abandons the current blank draft choice when New Chat is explicitly requested', async () => {
    await chooseDraft();
    expect(seen.state.activeDialogId).toBeNull();
    expect(seen.state.currentModelLabel).toBe('GPT Test');
    act(newDraft);
    expect(seen.state.currentModelLabel).toBe('Default Claude');
    expect(seen.modelSelection?.selectedModel).toBeNull();
  });
  it('keeps the choice when navigating within the same draft', async () => {
    await chooseDraft();
    await render('devices');
    expect(seen.state.currentModelLabel).toBe('GPT Test');
  });
  it('passes the draft choice through an ordinary first send', async () => {
    await chooseDraft();
    await act(async () => {
      await seen.state.sendMessage('Hello');
    });
    expect(create).toHaveBeenCalledWith({ agentType: 'ADMIN', model: MODEL });
    expect(seen.state.activeDialogId).toBe('created-chat');
  });
  it('locks model changes from an already captured menu callback during a pending first create', async () => {
    await chooseDraft();
    const staleSelect = seen.modelSelection?.selectModel;
    if (!staleSelect) throw new Error('No model selector configured');
    const held = holdCreation();
    let pending!: Promise<boolean | void>;
    await act(async () => {
      pending = seen.state.sendMessage('Hello');
    });
    expect(seen.modelSelection?.disabled).toBe(true);
    expect(seen.modelSelection?.menuItems[0].submenu?.every(item => item.disabled)).toBe(true);
    await act(async () => {
      await staleSelect(DEFAULT_MODEL);
    });
    expect(seen.state.currentModelLabel).toBe('GPT Test');
    await act(async () => {
      held.resolve('created-chat');
      await pending;
    });
    expect(create).toHaveBeenCalledWith({ agentType: 'ADMIN', model: MODEL });
  });
  it('restores an editable original choice after failed creation and retries with that choice', async () => {
    await chooseDraft();
    const held = holdCreation();
    const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
    let pending!: Promise<boolean | void>;
    await act(async () => {
      pending = seen.state.sendMessage('Hello');
    });
    await act(async () => {
      await seen.modelSelection?.selectModel(DEFAULT_MODEL);
    });
    await act(async () => {
      held.reject(new Error('Could not save chat'));
      await pending;
    });
    expect(seen.modelSelection?.disabled).toBe(false);
    expect(seen.state.currentModelLabel).toBe('GPT Test');
    await act(async () => {
      await seen.state.sendMessage('Hello again');
    });
    expect(create.mock.calls).toEqual([[{ agentType: 'ADMIN', model: MODEL }], [{ agentType: 'ADMIN', model: MODEL }]]);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to start conversation', variant: 'destructive' }),
    );
    failed.mockRestore();
  });
  it('keeps the choice locked until overlapping first-message creations have both settled', async () => {
    await chooseDraft();
    const first = holdCreation();
    const second = holdCreation();
    const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
    let firstSend!: Promise<boolean | void>;
    let secondSend!: Promise<boolean | void>;
    await act(async () => {
      firstSend = seen.state.sendMessage('First send');
      secondSend = seen.state.sendMessage('Second send');
    });
    expect(create).toHaveBeenCalledTimes(2);
    await act(async () => {
      first.reject(new Error('First creation failed'));
      await firstSend;
    });
    expect(seen.state.activeDialogId).toBeNull();
    expect(seen.modelSelection?.disabled).toBe(true);
    await act(async () => {
      await seen.modelSelection?.selectModel(DEFAULT_MODEL);
    });
    expect(seen.state.currentModelLabel).toBe('GPT Test');
    await act(async () => {
      second.reject(new Error('Second creation failed'));
      await secondSend;
    });
    expect(seen.modelSelection?.disabled).toBe(false);
    expect(seen.state.currentModelLabel).toBe('GPT Test');
    failed.mockRestore();
  });
  it('allows changing the original draft choice after a failed creation', async () => {
    await chooseDraft();
    create.mockRejectedValueOnce(new Error('Could not save chat'));
    const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      await seen.state.sendMessage('Hello');
    });
    await act(async () => {
      await seen.modelSelection?.selectModel(DEFAULT_MODEL);
    });
    expect(seen.state.currentModelLabel).toBe('Default Claude');
    await act(async () => {
      await seen.state.sendMessage('Retry');
    });
    expect(create).toHaveBeenLastCalledWith({ agentType: 'ADMIN', model: DEFAULT_MODEL });
    failed.mockRestore();
  });
  it('does not add model fields when the frontend flag is off', async () => {
    await chooseDraft();
    useFeatureFlagsStore.setState({ flags: { 'ai-mingo-chat-model-selection': false }, isLoaded: true });
    await render();
    await act(async () => {
      await seen.state.sendMessage('Hello');
    });
    expect(create).toHaveBeenCalledWith({ agentType: 'ADMIN' });
  });
});
