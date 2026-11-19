/**
 * What Mingo hands the lib's chat engine besides its transport and history: the link a dialog is copied as, Compact
 * behind its flag, the faces of history rows, the slash-command catalog a card's Display runs, and the engine's own
 * refresh. The engine draws all of them; this pins only that Mingo names them.
 */

import type { UseChatEngineConfig } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQueryClient } from '@/lib/query-client';
import { mingoDialogLink } from '@/lib/routes';
import { ticketService } from '../../tickets/services';
import { dialogModelQueryKey } from '../models/dialog-model-api';
import { useMingoModelDraftStore } from '../models/mingo-model-draft-store';
import type { MingoModelSelection } from '../models/use-mingo-model-selection';
import { useMingoCompactionStore } from '../stores/mingo-compaction-store';
import { useMingoUnifiedChatState } from './use-mingo-unified-chat-state';

const { captured, toast, flags, tenantHost, commands, modelSelection } = vi.hoisted(() => ({
  captured: { config: null as UseChatEngineConfig | null },
  toast: vi.fn(),
  flags: new Map<string, boolean>(),
  tenantHost: { url: 'https://acme.openframe.ai' },
  commands: [{ id: 'docs', description: 'Docs', primarySourceId: 'openframe-docs', actions: [] }],
  modelSelection: vi.fn<() => MingoModelSelection>(),
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', async importOriginal => ({
  ...(await importOriginal<object>()),
  useChatEngine: (engineConfig: UseChatEngineConfig) => {
    captured.config = engineConfig;
    return {
      activeDialogId: null,
      messages: [],
      streamingPhase: 'idle',
      isMessagesLoading: false,
      dialogs: [],
      currentContextWindowMaxTokens: 400_000,
    };
  },
  useSlashCommandRegistry: () => ({ commands }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/contexts', () => ({
  useChatRuntime: () => ({ endpoints: { commandsUrl: '/content/api/docs/commands' } }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast, dismiss: vi.fn() }) }));
vi.mock('@/app/hooks/use-feature-flag', () => ({ useFeatureFlag: (name: string) => flags.get(name) ?? false }));
vi.mock('@/app/hooks/use-ai-model', () => ({ useAiModelStatus: () => ({ aiModel: null }) }));
vi.mock('@/lib/nats/nats-app-config', () => ({
  useNatsAppConfig: () => ({ getWsUrl: () => 'wss://nats.test', onBeforeReconnect: undefined }),
}));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => tenantHost.url } }));
vi.mock('./use-mingo-dialog-row-status', () => ({ useMingoDialogRowStatus: () => () => undefined }));
vi.mock('../models/use-mingo-model-selection', () => ({
  MINGO_MODEL_FLAG: 'ai-mingo-chat-model-selection',
  useMingoModelSelection: modelSelection,
}));

let container: HTMLDivElement;
let root: Root;
const last: { chat: ReturnType<typeof useMingoUnifiedChatState> | null } = { chat: null };

function Probe() {
  const chat = useMingoUnifiedChatState({ onScreen: true });
  useEffect(() => {
    last.chat = chat;
  });
  return null;
}

function config(): UseChatEngineConfig {
  if (!captured.config) throw new Error('the engine was not configured');
  return captured.config;
}

function render() {
  act(() => root.render(<Probe />));
}

describe('useMingoUnifiedChatState: the engine config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flags.clear();
    modelSelection.mockReturnValue({ gate: 'off', current: null, contextSize: null, menuItems: [] });
    useMingoModelDraftStore.getState().setDraft(null);
    captured.config = null;
    last.chat = null;
    tenantHost.url = 'https://acme.openframe.ai';
    useMingoCompactionStore.setState({ compactingDialogIds: [] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('hands the engine the catalog, the faces of history rows and its refresh', () => {
    render();
    expect(config().slashCommands).toBe(commands);
    expect(config().avatarUrlOf?.('/api/image/a.png')).toMatch(/a\.png$/);
    expect(config().refresh).toMatchObject({
      intervalMs: 60_000,
      awaitingTitleMs: 10_000,
      expectingMs: 10_000,
      expecting: false,
      busyMs: 15_000,
    });
    expect(config().refresh?.allowed).toEqual(expect.any(Function));
  });

  it('says why an approval or a rejection the server refused did not go through', () => {
    render();
    config().onActionError?.('approve', new Error('AI budget exhausted'));
    config().onActionError?.('reject', 'boom');

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Approval Failed', description: 'AI budget exhausted', variant: 'destructive' }),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Rejection Failed', description: 'Unable to resolve request' }),
    );
  });

  it("creates a new chat on the draft's model behind its flag, then lets the draft go", async () => {
    const createDialog = vi.spyOn(ticketService, 'createDialog').mockResolvedValue('d-new');
    const gpt = { provider: 'OPENAI' as const, modelName: 'gpt-5.5', displayName: 'GPT-5.5' };
    useMingoModelDraftStore.setState({ draft: gpt });

    render();
    await act(async () => {
      await config().history?.createDialog?.({});
    });
    expect(createDialog).toHaveBeenLastCalledWith({ agentType: 'ADMIN' });
    expect(useMingoModelDraftStore.getState().draft).toEqual(gpt);

    flags.set('ai-mingo-chat-model-selection', true);
    render();
    await act(async () => {
      await config().history?.createDialog?.({});
    });
    expect(createDialog).toHaveBeenLastCalledWith({
      agentType: 'ADMIN',
      model: { provider: 'OPENAI', modelName: 'gpt-5.5' },
    });
    expect(useMingoModelDraftStore.getState().draft).toBeNull();
    expect(getQueryClient().getQueryData(dialogModelQueryKey('d-new'))).toMatchObject({ effectiveModel: gpt });
  });

  it('caches the model sent at creation and keeps a newer draft pick', async () => {
    const pending = Promise.withResolvers<string>();
    const createDialog = vi.spyOn(ticketService, 'createDialog').mockReturnValueOnce(pending.promise);
    const sent = { provider: 'OPENAI' as const, modelName: 'gpt-5.5', displayName: 'GPT-5.5' };
    const nextDraft = { provider: 'ANTHROPIC' as const, modelName: 'claude-sonnet-5', displayName: 'Claude Sonnet 5' };
    flags.set('ai-mingo-chat-model-selection', true);
    useMingoModelDraftStore.getState().setDraft(sent);
    render();

    await act(async () => {
      const creation = config().history?.createDialog?.({});
      useMingoModelDraftStore.getState().setDraft(nextDraft);
      pending.resolve('d-creating');
      await creation;
    });

    expect(createDialog).toHaveBeenCalledWith({
      agentType: 'ADMIN',
      model: { provider: sent.provider, modelName: sent.modelName },
    });
    expect(getQueryClient().getQueryData(dialogModelQueryKey('d-creating'))).toMatchObject({
      model: sent,
      effectiveModel: sent,
    });
    expect(useMingoModelDraftStore.getState().draft).toBe(nextDraft);
  });

  it('shows the draft model without the engine budget for another model', () => {
    render();
    expect(last.chat?.state.currentContextWindowMaxTokens).toBe(400_000);

    const current = { provider: 'OPENAI' as const, modelName: 'gpt-5.5', displayName: 'GPT-5.5' };
    modelSelection.mockReturnValue({ gate: 'on', current, contextSize: null, menuItems: [] });
    render();

    expect(last.chat?.state.currentModelLabel).toBe(current.displayName);
    expect(last.chat?.state.currentContextWindowMaxTokens).toBeNull();
  });

  it('offers Compact behind its flag, and says when one is already running', async () => {
    render();
    expect(config().history?.compactDialog).toBeUndefined();

    flags.set('mingo-compact-memory', true);
    render();
    const compactDialog = config().history?.compactDialog;
    await act(async () => {
      await compactDialog?.('d-1');
      await compactDialog?.('d-1');
    });

    expect(useMingoCompactionStore.getState().compactingDialogIds).toEqual(['d-1']);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({ title: 'Already compacting this chat' });
  });

  it('hands the counter its Usage panel only behind its flag', () => {
    render();
    expect(last.chat?.state.usagePanel).toBeNull();

    flags.set('mingo-chat-usage', true);
    render();
    expect(last.chat?.state.usagePanel).toEqual(expect.objectContaining({ context: expect.any(Object) }));
  });

  it('copies the canonical link on the tenant host', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render();

    await act(async () => {
      config().copyDialogLink?.({ id: 'd-1', title: 'Backups' });
    });

    expect(writeText).toHaveBeenCalledWith(`https://acme.openframe.ai${mingoDialogLink('d-1')}`);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Link copied' }));
  });

  it('shows the link in the toast when the clipboard refuses it, so it can still be copied by hand', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) } });
    render();

    await act(async () => {
      config().copyDialogLink?.({ id: 'd-1', title: 'Backups' });
    });

    expect(toast).toHaveBeenCalledWith({
      title: "Couldn't copy the link",
      description: `https://acme.openframe.ai${mingoDialogLink('d-1')}`,
      variant: 'destructive',
    });
  });

  it('copies nothing from a shell origin (capacitor://, tauri://): such a link is dead off the device', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    tenantHost.url = 'capacitor://localhost';
    render();

    await act(async () => {
      config().copyDialogLink?.({ id: 'd-1', title: 'Backups' });
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't copy the link", variant: 'destructive' }),
    );
  });
});
