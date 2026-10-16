/**
 * The Mingo-first composer dock: the session's one `EmbeddableChat`, laid out per
 * route — the thread portalled into the chat page's node (an element there, `null`
 * everywhere else, never `undefined`), Compact under the input off home, no memory
 * strip on full-width pages — plus the launcher drain, the paywall and its own crash
 * fallback.
 */

import { act, forwardRef, type ReactElement, type ReactNode, useEffect, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { routes } from '@/lib/routes';
import { useChatPageNodeStore } from './chat-page-node-store';
import { useComposerPreviewStore } from './composer-preview-store';
import { MingoComposerDock } from './mingo-composer-dock';
import { composerRouteOf } from './mingo-dock-route';

const {
  panel,
  nav,
  surface,
  builder,
  shell,
  identity,
  chips,
  CONTEXT_MEMORY,
  RESET_ONBOARDING_ITEMS,
  CAPABILITIES,
  PENDING_APPROVALS,
  RENDER_MENTION,
  RENDER_CONTEXT_ITEM,
} = vi.hoisted(() => ({
  panel: {
    props: null as Record<string, unknown> | null,
    mounts: 0,
    startNewChat: vi.fn(),
    prefillDraft: vi.fn(),
  },
  nav: { pathname: '/devices/', push: vi.fn() },
  surface: { value: null as unknown },
  builder: { lastOptions: null as Record<string, unknown> | null },
  shell: { mobile: false },
  identity: { enabled: null as boolean | null },
  chips: { onSend: null as ((text: string) => void) | null },
  CONTEXT_MEMORY: { items: [{ type: 'DEVICE', id: 'm-1', label: 'web-01' }], onRemove: () => {} },
  RESET_ONBOARDING_ITEMS: [{ id: 'reset-onboarding', label: 'Reset Onboarding' }],
  CAPABILITIES: { canRename: true, canArchive: true, unarchiveDialog: () => Promise.resolve() },
  PENDING_APPROVALS: [{ type: 'approval_request', data: { requestId: 'r-1', status: 'pending' } }],
  RENDER_MENTION: () => null,
  RENDER_CONTEXT_ITEM: () => null,
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({
  EmbeddableChat: forwardRef<unknown, Record<string, unknown>>(function FakeEmbeddableChat(props, ref) {
    useImperativeHandle(ref, () => ({ startNewChat: panel.startNewChat, prefillDraft: panel.prefillDraft }), []);
    useEffect(() => {
      panel.mounts += 1;
    }, []);
    panel.props = props;
    return null;
  }),
  ChatIdentityProvider: ({ children, enabled }: { children: ReactNode; enabled: boolean }) => {
    identity.enabled = enabled;
    return children;
  },
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/icons-v2', () => ({ PackageCheckIcon: () => null }));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
}));
vi.mock('@/lib/platform', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isMobileShell: () => shell.mobile,
}));
vi.mock('@/app/(app)/mingo/providers/mingo-chat-provider', () => ({
  useMingoChatSurface: () => surface.value,
}));
// The chips have tests of their own; here: where they show and what they send through.
vi.mock('./mingo-dock-quick-actions', () => ({
  MingoDockQuickActions: ({ onSend }: { onSend: (text: string) => void }) => {
    chips.onSend = onSend;
    return null;
  },
}));
// The shared builder is the classic entry's (tested there); here: what the dock asks of it.
vi.mock('../openframe-embeddable-chat-entry', () => ({
  OpenframeEmbeddableChatEntry: () => null,
  useOpenframeChatProps: (options: Record<string, unknown>) => {
    builder.lastOptions = options;
    return {
      props: {
        mingoState: { fromBuilder: true },
        contextMemory: CONTEXT_MEMORY,
        contextPicker: { fromBuilder: true },
        chatMenuExtraItems: RESET_ONBOARDING_ITEMS,
        mingoDialogCapabilities: CAPABILITIES,
        pendingApprovals: PENDING_APPROVALS,
        renderMention: RENDER_MENTION,
        renderContextItem: RENDER_CONTEXT_ITEM,
      },
      overlays: null,
    };
  },
}));

const compactDialog = vi.fn();
const sendInNewDialog = vi.fn(async () => {});
/** The session's thread handlers: the dock must hand them to the chat untouched. */
const loadMoreMessages = vi.fn();
const approveRequest = vi.fn();
const rejectRequest = vi.fn();
const stopMessage = vi.fn();

function setSurface({
  activeDialogId = null as string | null,
  enabled = true,
  compact = true,
  error = null as Error | null,
  identityEnabled = true,
} = {}) {
  surface.value = {
    chat: error
      ? null
      : {
          state: {
            activeDialogId,
            selectDialog: vi.fn(),
            sendMessage: vi.fn(),
            hasMoreMessages: true,
            loadMoreMessages,
            approveRequest,
            rejectRequest,
            stopMessage,
          },
          sendInNewDialog,
        },
    error,
    enabled,
    identityEnabled,
    compactDialog: compact ? compactDialog : undefined,
    copyDialogLink: vi.fn(),
  };
}

let container: HTMLDivElement;
let root: Root;

function render(pathname: string) {
  nav.pathname = pathname;
  act(() => {
    root.render(<MingoComposerDock />);
  });
}

const props = () => {
  if (!panel.props) throw new Error('the dock rendered no chat');
  return panel.props;
};

describe('MingoComposerDock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    panel.props = null;
    panel.mounts = 0;
    builder.lastOptions = null;
    shell.mobile = false;
    identity.enabled = null;
    setSurface();
    useChatPageNodeStore.setState({ node: null });
    useMingoLauncherStore.setState({
      dockMounted: false,
      dockRequest: null,
      pendingDraft: null,
      pendingPrompt: null,
      pendingNewChat: false,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  describe('thread container', () => {
    it("is the chat page's node on the chat page", () => {
      const node = document.createElement('div');
      useChatPageNodeStore.setState({ node });
      render('/mingo/chat/');
      expect(props().threadContainer).toBe(node);
    });

    it('is null on the chat page before it has published its node', () => {
      render('/mingo/chat/');
      expect('threadContainer' in props()).toBe(true);
      expect(props().threadContainer).toBeNull();
    });

    it('is null everywhere else, even while a chat page node is still published', () => {
      useChatPageNodeStore.setState({ node: document.createElement('div') });
      for (const pathname of ['/mingo/', '/devices/', '/devices/details/remote-shell/', '/settings/ai-settings/']) {
        render(pathname);
        expect('threadContainer' in props()).toBe(true);
        expect(props().threadContainer).toBeNull();
      }
    });

    it('keeps one chat mounted across routes and container changes', () => {
      const node = document.createElement('div');
      useChatPageNodeStore.setState({ node });
      for (const pathname of ['/mingo/', '/mingo/chat/', '/devices/details/remote-shell/', '/devices/', '/mingo/']) {
        render(pathname);
      }
      act(() => useChatPageNodeStore.setState({ node: null }));
      render('/mingo/chat/');
      act(() => useChatPageNodeStore.setState({ node }));
      expect(props().threadContainer).toBe(node);
      expect(panel.mounts).toBe(1);
    });
  });

  it('is a docked v2 chat that cannot close, without a rail, renaming inline', () => {
    render('/devices/');
    expect(props()).toMatchObject({
      shell: 'inline',
      appearance: 'v2',
      open: true,
      closable: false,
      rail: 'none',
      renameMode: 'inline',
      modelTooltip: 'Change in Settings → AI Settings',
      contextPicker: { fromBuilder: true },
    });
    // A same-tab navigation from a thread card reports a close: ignored.
    expect(() => (props().onOpenChange as (open: boolean) => void)(false)).not.toThrow();

    act(() => (props().onModelClick as () => void)());
    expect(nav.push).toHaveBeenCalledWith(routes.settings.aiSettings({ tab: 'mingo' }));
  });

  it("leaves the bottom safe-area inset to the phone shell's layout root, keeps its own on the web", () => {
    render('/devices/');
    expect(props().safeAreaBottom).toBe(true);

    shell.mobile = true;
    render('/mingo/');
    expect(props().safeAreaBottom).toBe(false);
  });

  it("shows the home chips' preview as ghost text in the composer", () => {
    render('/mingo/');
    expect(props().composerPreviewText).toBeNull();

    act(() => useComposerPreviewStore.getState().show('List every online machine'));
    expect(props().composerPreviewText).toBe('List every online machine');

    act(() => useComposerPreviewStore.getState().hide('List every online machine'));
    expect(props().composerPreviewText).toBeNull();
  });

  it('builds its chat with the shared builder, Compact left out of the chat menus', () => {
    render('/devices/');
    expect(builder.lastOptions).toMatchObject({ v2: true, compactDialog: undefined });
    // Quick actions start their chat through the follow-wrapped send, not the raw one.
    expect(typeof builder.lastOptions?.sendInNewDialog).toBe('function');
    expect(builder.lastOptions?.sendInNewDialog).not.toBe(sendInNewDialog);
    // The state the chat sends through is the dock's wrapper around the session's.
    expect(props().mingoState).toMatchObject({ activeDialogId: null, sendMessage: expect.any(Function) });
    expect(props().mingoState).not.toHaveProperty('fromBuilder');
  });

  it("hands the chat page header the builder's ⋯ extras and dialog actions (Reset Onboarding, Unarchive)", () => {
    useChatPageNodeStore.setState({ node: document.createElement('div') });
    render('/mingo/chat/');
    expect(props().chatMenuExtraItems).toBe(RESET_ONBOARDING_ITEMS);
    expect(props().mingoDialogCapabilities).toBe(CAPABILITIES);
  });

  describe('per route', () => {
    it('home: a new chat — no Compact, its own prompt, the model row, the quick actions', () => {
      chips.onSend = null;
      render('/mingo/');
      expect(chips.onSend).toBeTypeOf('function');
      // The lib's default: the model row is on every route, so the composer keeps its height.
      expect(props().showModel).toBeUndefined();
      expect(props()).toMatchObject({
        composerFooterActions: undefined,
        composerPlaceholder: 'Ask Mingo or describe a task…',
        contextMemory: CONTEXT_MEMORY,
      });
      expect(container.firstElementChild?.className).toContain('max-w-[880px]');
    });

    it('only home carries the quick actions', () => {
      chips.onSend = null;
      render('/devices/');
      expect(chips.onSend).toBeNull();
    });

    it('chat: the 760px column, the model row and Compact', () => {
      setSurface({ activeDialogId: 'd-1' });
      render('/mingo/chat/');
      expect(props()).toMatchObject({ composerPlaceholder: 'Reply to Mingo…' });
      expect(props().showModel).toBeUndefined();
      expect(props().composerFooterActions).toBeTruthy();
      expect(container.firstElementChild?.className).toContain('max-w-[760px]');
    });

    it('any other page: about this page, the memory strip and the model row', () => {
      render('/customers/details/');
      expect(props().showModel).toBeUndefined();
      expect(props()).toMatchObject({
        composerPlaceholder: 'Ask Mingo about this page…',
        contextMemory: CONTEXT_MEMORY,
      });
      expect(container.firstElementChild?.className).toContain('max-w-[880px]');
    });

    it('full-width pages: no memory strip, the model row kept', () => {
      for (const pathname of [
        '/devices/details/remote-desktop/',
        '/devices/details/remote-shell/',
        '/devices/details/file-manager/',
        '/scripts/edit/',
      ]) {
        render(pathname);
        expect(composerRouteOf(pathname)).toBe('full-width');
        expect(props()).toMatchObject({ contextMemory: undefined });
        expect(props().showModel).toBeUndefined();
      }
    });
  });

  describe('Compact under the input', () => {
    type CompactButton = ReactElement<{ disabled: boolean; onClick: () => void; children: ReactNode }>;
    const compact = () => (props().composerFooterActions as CompactButton).props;

    it('offers Compact chat memory for the open chat', () => {
      setSurface({ activeDialogId: 'd-1' });
      render('/devices/');
      expect(compact()).toMatchObject({ disabled: false, children: 'Compact chat memory' });
      act(() => compact().onClick());
      expect(compactDialog).toHaveBeenCalledWith('d-1');
      // Not in a ⋯ of the input row any more.
      expect(props().composerMenuItems).toBeUndefined();
    });

    it('is disabled with no chat open', () => {
      render('/devices/');
      expect(compact()).toMatchObject({ disabled: true });
    });

    it('is absent while the compact flag is off', () => {
      setSurface({ activeDialogId: 'd-1', compact: false });
      render('/mingo/chat/');
      expect(props().composerFooterActions).toBeUndefined();
    });
  });

  // MISSING 3.6-3.8: the thread on the chat page is the session's, with everything the
  // classic panel drew in it.
  it("portals the session's thread: approvals, mention and context chips, paging, Stop", () => {
    useChatPageNodeStore.setState({ node: document.createElement('div') });
    setSurface({ activeDialogId: 'd-1' });
    render('/mingo/chat/');
    expect(props()).toMatchObject({
      pendingApprovals: PENDING_APPROVALS,
      renderMention: RENDER_MENTION,
      renderContextItem: RENDER_CONTEXT_ITEM,
    });
    expect(props().mingoState).toMatchObject({
      activeDialogId: 'd-1',
      hasMoreMessages: true,
      loadMoreMessages,
      approveRequest,
      rejectRequest,
      stopMessage,
    });
  });

  // MISSING 5.7: the native shells keep identity off (AppShell's latch); the dock obeys it.
  it("hands the session's identity latch to its own identity provider", () => {
    render('/devices/');
    expect(identity.enabled).toBe(true);

    setSurface({ identityEnabled: false });
    render('/devices/');
    expect(identity.enabled).toBe(false);
  });

  it('renders nothing behind the paywall or before the session', () => {
    setSurface({ enabled: false });
    render('/devices/');
    expect(panel.props).toBeNull();
  });

  it('shows "Mingo is unavailable" with a retry when the chat crashes, not a blank shell', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setSurface({ error: new Error('boom') });
    render('/devices/');
    expect(container.textContent).toContain('Mingo is unavailable right now.');
    expect(panel.props).toBeNull();

    setSurface();
    act(() => container.querySelector('button')?.click());
    expect(panel.props).not.toBeNull();
    expect(container.textContent).not.toContain('Mingo is unavailable');
  });

  describe('launchers', () => {
    it('publishes itself to the launcher store while mounted', () => {
      render('/devices/');
      expect(useMingoLauncherStore.getState().dockMounted).toBe(true);
      act(() => root.unmount());
      root = createRoot(container);
      expect(useMingoLauncherStore.getState().dockMounted).toBe(false);
    });

    it('Fix with Mingo: goes home, then a new chat there with the draft in the composer', () => {
      render('/incidents/');
      const draft = { text: 'Fix the disk space incident' };
      act(() => useMingoLauncherStore.getState().draftToMingo(draft));

      // Not applied over the page it was raised from.
      expect(nav.push).toHaveBeenCalledTimes(1);
      expect(nav.push).toHaveBeenCalledWith(routes.mingo.home);
      expect(panel.prefillDraft).not.toHaveBeenCalled();

      render('/incidents/');
      expect(nav.push).toHaveBeenCalledTimes(1);

      render('/mingo/');
      expect(panel.prefillDraft).toHaveBeenCalledTimes(1);
      expect(panel.prefillDraft).toHaveBeenCalledWith(draft);
      expect(useMingoLauncherStore.getState().dockRequest).toBeNull();
      expect(useMingoLauncherStore.getState().isOpen).toBe(false);
    });

    it('start a new chat: already on home, stays there', () => {
      render('/mingo/');
      act(() => useMingoLauncherStore.getState().startNewChat());
      expect(panel.startNewChat).toHaveBeenCalledTimes(1);
      expect(nav.push).not.toHaveBeenCalled();
    });

    it('Meet Mingo: the prompt is sent in a new chat', () => {
      render('/onboarding/');
      act(() => useMingoLauncherStore.getState().sendToMingo('What can you do?'));
      expect(sendInNewDialog).toHaveBeenCalledWith('What can you do?');
      expect(useMingoLauncherStore.getState().pendingPrompt).toBeNull();
    });
  });
});
