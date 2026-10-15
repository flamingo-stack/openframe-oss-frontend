/**
 * The chat panel reads the session's chat state from `MingoChatProvider` instead of
 * building its own, registers itself so that state runs while it is mounted, and
 * still drains the launcher's draft / new-chat requests through its handle — which
 * only exists once the state has landed, a pass after the panel first renders.
 */

import { act, forwardRef, type ReactNode, StrictMode, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeChatProbe, makeFakeChat, resetFakeChatProbe } from '../(app)/mingo/providers/__tests__/fake-mingo-chat';
import { MingoChatProvider } from '../(app)/mingo/providers/mingo-chat-provider';
import { useMingoLauncherStore } from '../(app)/mingo/stores/mingo-launcher-store';
import { ChatDrawerErrorBoundary } from './chat-drawer-error-boundary';
import { OpenframeEmbeddableChatEntry } from './openframe-embeddable-chat-entry';

const { panel, onboarding } = vi.hoisted(() => ({
  onboarding: { canReset: false },
  panel: {
    props: null as Record<string, unknown> | null,
    startNewChat: vi.fn(),
    prefillDraft: vi.fn(),
  },
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({
  EmbeddableChat: forwardRef<unknown, Record<string, unknown>>(function FakeEmbeddableChat(props, ref) {
    useImperativeHandle(ref, () => ({ startNewChat: panel.startNewChat, prefillDraft: panel.prefillDraft }));
    panel.props = props;
    return null;
  }),
  getAgentAccent: () => 'mingo',
  renderQuickActionIcon: () => null,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/icons-v2', () => ({ Refresh01RightIcon: () => null }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn() }),
}));

// The state the provider runs, and what runs beside it.
vi.mock('../(app)/mingo/hooks/use-mingo-unified-chat-state', async () => ({
  useMingoUnifiedChatState: (await import('../(app)/mingo/providers/__tests__/fake-mingo-chat'))
    .useFakeMingoUnifiedChatState,
}));
vi.mock('../(app)/mingo/hooks/use-mingo-realtime-subscription', async () => ({
  DialogSubscription: (await import('../(app)/mingo/providers/__tests__/fake-mingo-chat')).FakeDialogSubscription,
}));
vi.mock('../(app)/mingo/hooks/use-mingo-dialog-selection', () => ({
  MINGO_DIALOG_NOT_FOUND: 'MINGO_DIALOG_NOT_FOUND',
}));
vi.mock('./mingo-compaction-watchers', () => ({ MingoCompactionWatchers: () => null }));

// The panel's own data sources, none of which this test is about.
vi.mock('../(app)/help-center/endpoints', () => ({ KNOWLEDGE_BASE_ROUTE: '/help-center/knowledge-base' }));
vi.mock('../(app)/mingo/context/context-sources', () => ({ useMingoContextEntityTypes: () => [] }));
vi.mock('../(app)/mingo/context/mention-chips/render-mention', () => ({
  renderMingoContextItem: () => null,
  renderMingoMention: () => null,
}));
vi.mock('../(app)/mingo/context/render-context-items', () => ({ renderMingoContextItems: () => null }));
vi.mock('../(app)/mingo/context/use-context-memory', () => ({ useMingoContextMemory: () => undefined }));
vi.mock('../(app)/mingo/hooks/use-mingo-quick-actions', () => ({ useMingoQuickActions: () => [] }));
vi.mock('../(app)/mingo/hooks/use-mingo-what-to-ask', () => ({ useMingoWhatToAsk: () => async () => [] }));
vi.mock('./reset-onboarding-dialog', () => ({
  ResetOnboardingDialog: () => null,
  useCanResetOnboarding: () => onboarding.canReset,
}));
vi.mock('../(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (select: (state: { user: null }) => unknown) => select({ user: null }),
}));
vi.mock('@/app/hooks/use-feature-flag', () => ({ useFeatureFlag: () => false }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => 'https://acme.openframe.ai' } }));
vi.mock('@/lib/image-url', () => ({ getFullImageUrl: () => undefined }));

let container: HTMLDivElement;
let root: Root;

function render(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

function shell(panelMounted: boolean) {
  return (
    <MingoChatProvider enabled identityEnabled={false}>
      {panelMounted ? (
        <ChatDrawerErrorBoundary>
          <OpenframeEmbeddableChatEntry open onOpenChange={() => {}} />
        </ChatDrawerErrorBoundary>
      ) : null}
    </MingoChatProvider>
  );
}

describe('OpenframeEmbeddableChatEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    panel.props = null;
    onboarding.canReset = false;
    resetFakeChatProbe(makeFakeChat({ activeDialogId: 'd-1' }));
    useMingoLauncherStore.setState({ pendingPrompt: null, pendingDraft: null, pendingNewChat: false });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders the provider's chat state instead of building its own", () => {
    render(shell(true));

    const chat = fakeChatProbe.result;
    expect(fakeChatProbe.created).toBe(1);
    expect(panel.props?.mingoState).toBe(chat?.state);
    expect(panel.props?.pendingApprovals).toBe(chat?.pendingApprovals);
    expect(panel.props?.mingoDialogCapabilities).toMatchObject({
      searchQuery: chat?.searchQuery,
      onSearchChange: chat?.setSearchQuery,
      fetchArchivedDialogs: chat?.fetchArchivedDialogs,
      unarchiveDialog: chat?.unarchiveDialog,
      onCopyLink: expect.any(Function),
      // `mingo-compact-memory` is off.
      compactDialog: undefined,
    });
  });

  it('keeps the state running exactly while it is mounted', () => {
    render(shell(false));
    expect(fakeChatProbe.mounted).toBe(0);

    render(shell(true));
    expect(fakeChatProbe.mounted).toBe(1);
    expect(fakeChatProbe.liveTails).toEqual(['d-1']);

    render(shell(false));
    expect(fakeChatProbe.mounted).toBe(0);
    expect(fakeChatProbe.liveTails).toEqual([]);
  });

  it('runs one state under StrictMode', () => {
    render(<StrictMode>{shell(true)}</StrictMode>);

    expect(fakeChatProbe.mounted).toBe(1);
    expect(fakeChatProbe.liveTails).toEqual(['d-1']);
    expect(panel.props?.mingoState).toBe(fakeChatProbe.result?.state);
  });

  it('drains a draft queued before it opened into the panel it opens with', () => {
    const draft = { text: 'Fix the disk space incident' };
    act(() => {
      useMingoLauncherStore.getState().draftToMingo(draft);
    });

    render(shell(true));

    expect(panel.prefillDraft).toHaveBeenCalledTimes(1);
    expect(panel.prefillDraft).toHaveBeenCalledWith(draft);
    expect(useMingoLauncherStore.getState().pendingDraft).toBeNull();
  });

  it('drains a new-chat request, on open and while open', () => {
    act(() => {
      useMingoLauncherStore.getState().startNewChat();
    });
    render(shell(true));
    expect(panel.startNewChat).toHaveBeenCalledTimes(1);

    act(() => {
      useMingoLauncherStore.getState().startNewChat();
    });
    expect(panel.startNewChat).toHaveBeenCalledTimes(2);
  });

  // The props are built by `useOpenframeChatProps`, shared with the Mingo-first
  // dock. The classic surfaces must pass exactly what they passed before it was
  // extracted — and nothing of the dock's split layout.
  const CLASSIC_PROP_KEYS = [
    'appearance',
    'baseRoute',
    'chatMenuExtraItems',
    'closable',
    'collapseTo',
    'contextMemory',
    'contextPicker',
    'dialogStatusOf',
    'mingoDialogCapabilities',
    'mingoState',
    'mingoWelcome',
    'modes',
    'onCollapse',
    'onExpand',
    'onOpenChange',
    'open',
    'pendingApprovals',
    'renderContextItem',
    'renderMention',
    'shell',
    'userAvatarUrl',
    'userDisplayName',
    'whatToAsk',
  ];

  it('passes the classic drawer the same props as before the shared builder', () => {
    render(shell(true));

    expect(Object.keys(panel.props ?? {}).sort()).toEqual(CLASSIC_PROP_KEYS);
    expect(panel.props).toMatchObject({
      shell: 'none',
      appearance: 'classic',
      open: true,
      closable: true,
      modes: {},
      baseRoute: '/help-center/knowledge-base',
      dialogStatusOf: undefined,
      whatToAsk: undefined,
      chatMenuExtraItems: undefined,
      mingoWelcome: undefined,
      contextPicker: { entityTypes: [], maxItems: 10 },
      mingoDialogCapabilities: { canRename: true, canArchive: true },
    });
    expect(typeof panel.props?.renderMention).toBe('function');
    expect(typeof panel.props?.renderContextItem).toBe('function');
  });

  it('passes the v2 side panel the same props as before the shared builder', () => {
    const onCollapse = vi.fn();
    render(
      <MingoChatProvider enabled identityEnabled={false}>
        <OpenframeEmbeddableChatEntry
          shell="inline"
          open
          onOpenChange={() => {}}
          closable={false}
          v2={{ onCollapse, collapseTo: 'column' }}
        />
      </MingoChatProvider>,
    );

    expect(Object.keys(panel.props ?? {}).sort()).toEqual(CLASSIC_PROP_KEYS);
    expect(panel.props).toMatchObject({
      shell: 'inline',
      appearance: 'v2',
      closable: false,
      onCollapse,
      collapseTo: 'column',
      dialogStatusOf: fakeChatProbe.result?.dialogStatusOf,
      whatToAsk: expect.any(Function),
    });
  });

  // What the Mingo-first dock relies on from the same builder (its page header ⋯
  // on the chat page): Reset Onboarding in v2 (MISSING 3.3) and Unarchive (3.1).
  it('v2: offers Reset Onboarding in the chat ⋯ and every dialog action', () => {
    onboarding.canReset = true;
    render(
      <MingoChatProvider enabled identityEnabled={false}>
        <OpenframeEmbeddableChatEntry shell="inline" open onOpenChange={() => {}} closable={false} v2={{}} />
      </MingoChatProvider>,
    );

    const chat = fakeChatProbe.result;
    expect(panel.props?.chatMenuExtraItems).toEqual([
      expect.objectContaining({ id: 'reset-onboarding', label: 'Reset Onboarding' }),
    ]);
    expect(panel.props?.mingoDialogCapabilities).toMatchObject({
      canRename: true,
      canArchive: true,
      unarchiveDialog: chat?.unarchiveDialog,
      fetchArchivedDialogs: chat?.fetchArchivedDialogs,
      onCopyLink: expect.any(Function),
    });
  });

  it('shows a crashed state in its own boundary', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fakeChatProbe.crash = new Error('boom');

    render(shell(true));

    expect(container.textContent).toContain('Mingo is unavailable right now');
  });
});
