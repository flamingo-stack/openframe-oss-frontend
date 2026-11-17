/**
 * What Mingo hands the lib's chat engine besides its transport and history: the link a dialog is copied as, Compact
 * behind its flag, the faces of history rows, the slash-command catalog a card's Display runs, and the engine's own
 * refresh. The engine draws all of them; this pins only that Mingo names them.
 */

import type { ChatUsagePanelData, UseChatEngineConfig } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api-client';
import { mingoDialogLink } from '@/lib/routes';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { useMingoCompactionStore } from '../stores/mingo-compaction-store';
import { mingoDialogs, useMingoUnifiedChatState } from './use-mingo-unified-chat-state';

const { captured, toast, flags, tenantHost, commands, platform } = vi.hoisted(() => ({
  captured: { config: null as UseChatEngineConfig | null, usagePanel: null as ChatUsagePanelData | null | undefined },
  toast: vi.fn(),
  flags: new Map<string, boolean>(),
  tenantHost: { url: 'https://acme.openframe.ai' },
  platform: { kind: 'web' },
  commands: [{ id: 'docs', description: 'Docs', primarySourceId: 'openframe-docs', actions: [] }],
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', async importOriginal => ({
  ...(await importOriginal<object>()),
  useChatEngine: (engineConfig: UseChatEngineConfig) => {
    captured.config = engineConfig;
    return { activeDialogId: null, messages: [], streamingPhase: 'idle', isMessagesLoading: false, dialogs: [] };
  },
  useSlashCommandRegistry: () => ({ commands }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/contexts', () => ({
  useChatRuntime: () => ({ endpoints: { commandsUrl: '/content/api/docs/commands' } }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast, dismiss: vi.fn() }) }));

vi.mock('@/lib/platform', async importOriginal => ({
  ...(await importOriginal<object>()),
  isMobileShell: () => platform.kind === 'mobile',
  isDesktopShell: () => platform.kind === 'desktop',
}));

vi.mock('@/app/hooks/use-feature-flag', () => ({ useFeatureFlag: (name: string) => flags.get(name) ?? false }));
vi.mock('@/app/hooks/use-ai-model', () => ({ useAiModelStatus: () => ({ aiModel: null }) }));
vi.mock('@/lib/nats/nats-app-config', () => ({
  useNatsAppConfig: () => ({ getWsUrl: () => 'wss://nats.test', onBeforeReconnect: undefined }),
}));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => tenantHost.url } }));
vi.mock('./use-mingo-dialog-row-status', () => ({ useMingoDialogRowStatus: () => () => undefined }));

let container: HTMLDivElement;
let root: Root;

function Probe() {
  const panel = useMingoUnifiedChatState({ onScreen: true }).state.usagePanel;
  useLayoutEffect(() => {
    captured.usagePanel = panel;
  }, [panel]);
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
    platform.kind = 'web';
    captured.config = null;
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

  it('leaves the old counter without a panel while Usage is off, and restores it on enable', () => {
    render();
    expect(captured.usagePanel).toBeNull();
    expect(config().recordReadKey).toBe(false);
    expect(config()).toHaveProperty('effectiveContextBudget', false);
    flags.set('mingo-chat-usage', true);
    render();
    expect(captured.usagePanel).toMatchObject({ breakdown: null });
    expect(config().recordReadKey).toBe(true);
    expect(config()).toHaveProperty('effectiveContextBudget', true);
    flags.set('mingo-chat-usage', false);
    render();
    expect(captured.usagePanel).toBeNull();
  });

  it.each(['mobile', 'desktop'])('keeps the Usage panel compatible with the %s shell', kind => {
    platform.kind = kind;
    flags.set('mingo-chat-usage', true);
    render();
    expect(captured.usagePanel == null).toBe(kind === 'mobile');
    expect(config().recordReadKey).toBe(kind !== 'mobile');
    expect(config()).toHaveProperty('effectiveContextBudget', kind !== 'mobile');
  });

  it('does not request expanded usage on mobile while retaining it on desktop', async () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-chat-usage', enabled: true }]);
    const request = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ ok: true, status: 200, data: { data: { dialog: null } } });
    try {
      platform.kind = 'mobile';
      await mingoDialogs.fetchDialog('d1');
      expect(request.mock.lastCall?.[1]).toMatchObject({ query: expect.not.stringContaining('cacheReadTokensSize') });
      platform.kind = 'desktop';
      await mingoDialogs.fetchDialog('d1');
      expect(request.mock.lastCall?.[1]).toMatchObject({ query: expect.stringContaining('cacheReadTokensSize') });
    } finally {
      request.mockRestore();
      useFeatureFlagsStore.getState().reset();
    }
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
