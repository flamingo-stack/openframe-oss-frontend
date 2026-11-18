import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { type MingoUnifiedChat, useMingoUnifiedChatState } from './use-mingo-unified-chat-state';

const { post, engine } = vi.hoisted(() => ({ post: vi.fn(), engine: { outcome: 'stopped' } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { post }, REQUEST_TIMEOUT_MS: 30_000 }));

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', async importOriginal => ({
  ...(await importOriginal<object>()),
  useChatEngine: () => ({
    activeDialogId: 'a',
    streamingPhase: 'idle',
    isLoading: false,
    isMessagesLoading: false,
    dialogs: [],
    currentProvider: 'ANTHROPIC',
    currentModelLabel: 'Claude Opus 5.5',
    currentContextWindowMaxTokens: 200_000,
    messages: [
      {
        id: 'first-reply',
        role: 'assistant',
        parts: [],
        metadata: {
          provider: 'ANTHROPIC',
          model: 'claude-opus-5-5',
          finishReason: engine.outcome === 'stopped' ? 'interrupted' : 'error',
        },
      },
    ],
  }),
  useSlashCommandRegistry: () => ({ commands: [] }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/contexts', () => ({ useChatRuntime: () => ({ endpoints: {} }) }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/app/hooks/use-ai-model', () => ({
  useAiModelStatus: () => ({
    aiModel: { provider: 'ANTHROPIC', modelName: 'claude-opus-5-5', displayName: 'Claude Opus 5.5' },
  }),
}));
vi.mock('@/app/(app)/settings/ai-settings/hooks/use-supported-models', () => ({
  useSupportedModels: () => ({
    modelsByProvider: { OPENAI: [{ value: 'gpt-6-luna', label: 'GPT-6 Luna' }] },
    isLoading: false,
  }),
}));
vi.mock('@/lib/nats/nats-app-config', () => ({ useNatsAppConfig: () => ({ getWsUrl: () => 'wss://nats.test' }) }));
vi.mock('./use-mingo-dialog-row-status', () => ({ useMingoDialogRowStatus: () => () => undefined }));

let root: Root;
let client: QueryClient;
const seen: { value: MingoUnifiedChat | null } = { value: null };
function Probe() {
  const result = useMingoUnifiedChatState({ onScreen: false });
  useLayoutEffect(() => {
    seen.value = result;
  });
  return null;
}
beforeEach(() => {
  vi.clearAllMocks();
  seen.value = null;
  useFeatureFlagsStore.setState({ flags: { 'ai-mingo-chat-model-selection': true }, isLoaded: true });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root = createRoot(document.createElement('div'));
  const model = { provider: 'OPENAI', modelName: 'gpt-6-luna', displayName: 'GPT-6 Luna' };
  post.mockResolvedValue({
    ok: true,
    data: {
      data: {
        dialog: {
          id: 'relay-a',
          dialogId: 'a',
          agentType: 'ADMIN',
          status: 'ACTIVE',
          streamState: 'IDLE',
          pendingApproval: null,
          model,
          effectiveModel: model,
          tokenUsage: [],
          modelTokenBudget: 150_000,
        },
      },
    },
  });
});
afterEach(() => {
  act(() => root.unmount());
  client.clear();
  useFeatureFlagsStore.getState().reset();
});

async function queryTick() {
  await new Promise(resolve => setTimeout(resolve, 20));
}
async function waitForSelectedModel() {
  for (let attempt = 0; attempt < 100 && seen.value?.state.currentModelLabel !== 'GPT-6 Luna'; attempt++) {
    await act(queryTick);
  }
}

describe('model budget after the first reply ended without usage', () => {
  it.each(['stopped', 'failed'])(
    'replaces retained Claude metadata after a %s reply with the selected GPT budget',
    async outcome => {
      engine.outcome = outcome;
      await act(async () => {
        root.render(
          <QueryClientProvider client={client}>
            <Probe />
          </QueryClientProvider>,
        );
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      await waitForSelectedModel();
      expect(seen.value?.state.currentModelLabel).toBe('GPT-6 Luna');
      expect(seen.value?.state.currentContextWindowMaxTokens).toBe(150_000);
    },
  );
});
