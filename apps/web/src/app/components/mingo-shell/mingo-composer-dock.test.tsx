/**
 * The Mingo-first composer dock: the session's one `EmbeddableChat`, laid out per
 * route — the thread portalled into the chat page's node (an element there, `null`
 * everywhere else, never `undefined`), Compact in the chat's ⋯, no memory
 * strip on full-width pages — plus the launcher drain, the locked composer that holds
 * its place while the chat loads, and its own crash fallback.
 */

import { act, forwardRef, type ReactElement, type ReactNode, useEffect, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { routes } from '@/lib/routes';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { useChatPageNodeStore } from './chat-page-node-store';
import { useComposerPreviewStore } from './composer-preview-store';
import { MingoComposerDock } from './mingo-composer-dock';
import { composerRouteOf } from './mingo-dock-route';
import { useMingoDockWidgetStore } from './mingo-dock-widget';
import { useMingoSheetStore } from './mingo-sheet-store';

const {
  panel,
  nav,
  surface,
  builder,
  shell,
  identity,
  chips,
  bar,
  CONTEXT_MEMORY,
  CAPABILITIES,
  PENDING_APPROVALS,
  RENDER_MENTION,
  RENDER_CONTEXT_ITEM,
} = vi.hoisted(() => ({
  panel: {
    props: null as Record<string, unknown> | null,
    mounts: 0,
    /** The chat module has loaded: the handle exists. */
    loaded: true,
    /** The locked composer's props, while it draws. */
    loading: null as Record<string, unknown> | null,
    startNewChat: vi.fn(),
    showWhatToAsk: vi.fn(),
    prefillDraft: vi.fn(),
  },
  nav: { pathname: '/devices/', push: vi.fn() },
  surface: { value: null as unknown },
  builder: { lastOptions: null as Record<string, unknown> | null },
  shell: { mobile: false },
  identity: { enabled: null as boolean | null },
  chips: { onSend: null as ((text: string) => void) | null },
  /** A page's window-pinned action bar (`PageActions` below md): its height, 0 for none. */
  bar: { height: 0 },
  CONTEXT_MEMORY: { items: [{ type: 'DEVICE', id: 'm-1', label: 'web-01' }], onRemove: () => {} },
  CAPABILITIES: { canRename: true, canArchive: true, unarchiveDialog: () => Promise.resolve() },
  PENDING_APPROVALS: [{ type: 'approval_request', data: { requestId: 'r-1', status: 'pending' } }],
  RENDER_MENTION: () => null,
  RENDER_CONTEXT_ITEM: () => null,
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({
  EmbeddableChat: forwardRef<unknown, Record<string, unknown>>(function FakeEmbeddableChat(props, ref) {
    const { loaded } = panel;
    useImperativeHandle(
      ref,
      () =>
        loaded
          ? { startNewChat: panel.startNewChat, prefillDraft: panel.prefillDraft, showWhatToAsk: panel.showWhatToAsk }
          : null,
      [loaded],
    );
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
  ChatComposer: (props: Record<string, unknown>) => {
    panel.loading = props;
    return <p>locked composer</p>;
  },
  ModelDisplay: () => null,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components', () => ({
  LoadingRegion: ({ children }: { children: ReactNode }) => <div aria-busy="true">{children}</div>,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/icons-v2', () => ({
  Chevron02UpIcon: () => null,
  MessageTextIcon: () => null,
  PackageCheckIcon: () => null,
  Refresh01RightIcon: () => null,
  Collapse02Icon: () => null,
  Expand02Icon: () => null,
  XmarkIcon: () => null,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', () => ({
  Button: ({ children, onClick, ...rest }: { children: ReactNode; onClick?: () => void; 'aria-label'?: string }) => (
    <button type="button" onClick={onClick} aria-label={rest['aria-label']}>
      {children}
    </button>
  ),
  useMobileActionBarHeight: () => bar.height,
}));
// The button has tests of its own (dragging, where it settles); here: when the dock draws it.
vi.mock('./mingo-dock-widget', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  MingoDockWidget: ({ onOpen }: { onOpen: () => void }) => (
    <button type="button" onClick={onOpen}>
      Ask Mingo
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
// The tour has tests of its own (and its Relay reads need the compiler): no tour here,
// the state passes through.
vi.mock('@/app/(app)/mingo/tour/use-mingo-tour', () => ({
  useMingoTour: ({ state }: { state: unknown }) => ({ state, aboveComposer: null }),
}));
vi.mock('../reset-onboarding-dialog', () => ({
  ResetOnboardingDialog: () => null,
  useCanResetOnboarding: () => false,
}));
vi.mock('../dev-onboarding-shortcuts', () => ({
  ResetInitialSetupDialog: () => null,
  useDevOnboardingMenuItems: () => [],
}));
// The chip has tests of its own (its sources import Relay queries); none here.
vi.mock('./use-page-chip', () => ({ usePageChip: () => null }));
// The props builder has tests of its own; here: what the dock asks of it.
vi.mock('./use-openframe-chat-props', () => ({
  useOpenframeChatProps: (options: Record<string, unknown>) => {
    builder.lastOptions = options;
    return {
      mingoState: { fromBuilder: true },
      contextMemory: CONTEXT_MEMORY,
      contextPicker: { fromBuilder: true },
      mingoDialogCapabilities: CAPABILITIES,
      pendingApprovals: PENDING_APPROVALS,
      renderMention: RENDER_MENTION,
      renderContextItem: RENDER_CONTEXT_ITEM,
    };
  },
}));

const compactDialog = vi.fn();
const sendInNewDialog = vi.fn(async () => {});
const createIntentDialog = vi.fn(async () => null);
const selectDialog = vi.fn();
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
            dialogs: [],
            messages: [],
            selectDialog,
            sendMessage: vi.fn(),
            hasMoreMessages: true,
            loadMoreMessages,
            approveRequest,
            rejectRequest,
            stopMessage,
          },
          sendInNewDialog,
          createIntentDialog,
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

/** The chat draws the leading context node; here it lands in a node of its own. */
const leadingRoots: Root[] = [];
function renderLeading(): HTMLElement {
  const node = document.createElement('div');
  container.appendChild(node);
  const leadingRoot = createRoot(node);
  leadingRoots.push(leadingRoot);
  act(() => leadingRoot.render(props().composerContextLeading as ReactNode));
  return node;
}

interface HeaderAction {
  label: string;
  onClick: () => void;
}
/** The sheet's header actions the dock handed the chat. */
const headerActions = () => (props().threadHeaderActions as HeaderAction[] | undefined) ?? [];

describe('MingoComposerDock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    panel.props = null;
    panel.mounts = 0;
    panel.loaded = true;
    panel.loading = null;
    builder.lastOptions = null;
    shell.mobile = false;
    identity.enabled = null;
    setSurface();
    // A published node is a page that has let the thread in, unless a test says otherwise.
    useChatPageNodeStore.setState({ node: null, chatMounted: false, threadReady: true });
    useFeatureFlagsStore.getState().reset();
    useMingoLauncherStore.setState({ dockMounted: false, dockRequest: null });
    useMingoSheetStore.setState({ open: false, openAfterNavigation: false, node: null, lastPage: null });
    bar.height = 0;
    useMingoDockWidgetStore.setState({ open: false });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      for (const leadingRoot of leadingRoots.splice(0)) leadingRoot.unmount();
    });
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

    it('is null on the chat page until the page lets the thread in, then its node', () => {
      const node = document.createElement('div');
      useChatPageNodeStore.setState({ node, threadReady: false });
      render('/mingo/chat/');
      expect('threadContainer' in props()).toBe(true);
      expect(props().threadContainer).toBeNull();
      act(() => useChatPageNodeStore.setState({ threadReady: true }));
      expect(props().threadContainer).toBe(node);
      expect(panel.mounts).toBe(1);
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

    it("is the sheet's node over a page while the sheet is up, with its two header actions", () => {
      setSurface({ activeDialogId: 'a' });
      const node = document.createElement('div');
      useMingoSheetStore.setState({ open: true, node });
      for (const pathname of ['/devices/', '/devices/details/remote-shell/']) {
        render(pathname);
        expect(props().threadContainer).toBe(node);
        expect(headerActions().map(action => action.label)).toEqual(['Open as full chat', 'Back to page']);
        expect(props().composerPlaceholder).toBe('Reply to Mingo…');
      }
    });

    it("centres the thread at the composer's width on the chat page only", () => {
      setSurface({ activeDialogId: 'a' });
      render('/mingo/chat/');
      expect(props().threadContentClassName).toBe('mx-auto w-full max-w-[760px]');
      useMingoSheetStore.setState({ open: true, node: document.createElement('div') });
      render('/devices/');
      expect(props().threadContentClassName).toBeUndefined();
    });

    it('ignores an open sheet on the chat page', () => {
      setSurface({ activeDialogId: 'a' });
      useMingoSheetStore.setState({ open: true, node: document.createElement('div') });
      const pageNode = document.createElement('div');
      useChatPageNodeStore.setState({ node: pageNode });
      render('/mingo/chat/');
      expect(props().threadContainer).toBe(pageNode);
    });

    it('raises a chat not created yet over home ("What to ask Mingo?"), with only a way back', () => {
      const sheetNode = document.createElement('div');
      useMingoSheetStore.setState({ open: true, node: sheetNode });
      render('/mingo/');
      expect(props().threadContainer).toBe(sheetNode);
      expect(headerActions().map(action => action.label)).toEqual(['Back to page']);
      act(() => headerActions()[0].onClick());
      expect(useMingoSheetStore.getState().open).toBe(false);
    });

    it('shows "What to ask Mingo?" over the page, and in place on the chat page', () => {
      render('/devices/');
      act(() => useMingoLauncherStore.getState().showWhatToAsk());
      expect(panel.showWhatToAsk).toHaveBeenCalledTimes(1);
      expect(useMingoSheetStore.getState().open).toBe(true);
      expect(useMingoLauncherStore.getState().dockRequest).toBeNull();

      act(() => useMingoSheetStore.setState({ open: false }));
      render('/mingo/chat/');
      act(() => useMingoLauncherStore.getState().showWhatToAsk());
      expect(panel.showWhatToAsk).toHaveBeenCalledTimes(2);
      expect(useMingoSheetStore.getState().open).toBe(false);
    });

    it("leads to the chat's page from the sheet, or back to the page", () => {
      setSurface({ activeDialogId: 'a' });
      useMingoSheetStore.setState({ open: true, node: document.createElement('div') });
      render('/devices/');
      const [full, back] = headerActions();
      act(() => back.onClick());
      expect(useMingoSheetStore.getState().open).toBe(false);
      expect(nav.push).not.toHaveBeenCalled();

      act(() => useMingoSheetStore.setState({ open: true }));
      act(() => full.onClick());
      // Up over the page until the chat page comes: the page never shows undimmed meanwhile.
      expect(useMingoSheetStore.getState().open).toBe(true);
      expect(nav.push).toHaveBeenCalledWith(routes.mingo.chat('a'));
      render('/mingo/chat/');
      expect(props().threadContainer).not.toBe(useMingoSheetStore.getState().node);
    });

    it('is up from the first frame of the page it was asked to open on', () => {
      setSurface({ activeDialogId: 'a' });
      const sheetNode = document.createElement('div');
      useMingoSheetStore.setState({
        open: false,
        openAfterNavigation: true,
        askedFrom: '/mingo/chat',
        node: sheetNode,
      });
      render('/devices/');
      expect(props().threadContainer).toBe(sheetNode);
    });

    it('leads every chat page back to the last page, raised over it again', () => {
      setSurface({ activeDialogId: 'a' });
      useMingoSheetStore.setState({ lastPage: '/devices/?statuses=ONLINE' });
      render('/mingo/chat/');
      const [back] = headerActions();
      expect(back.label).toBe('Back to page');
      act(() => back.onClick());
      expect(nav.push).toHaveBeenCalledWith('/devices/?statuses=ONLINE');
      expect(useMingoSheetStore.getState()).toMatchObject({ openAfterNavigation: true });
      // The buttons stay until the page is reached.
      expect(headerActions().map(action => action.label)).toEqual(['Back to page', 'Close chat']);
    });

    it('closes every chat page to the last page, leaving the chat behind it', () => {
      setSurface({ activeDialogId: 'a' });
      useMingoSheetStore.setState({ lastPage: '/devices/?statuses=ONLINE' });
      render('/mingo/chat/');
      const close = headerActions()[1];
      expect(close.label).toBe('Close chat');
      act(() => close.onClick());
      expect(nav.push).toHaveBeenCalledWith('/devices/?statuses=ONLINE');
      expect(useMingoSheetStore.getState()).toMatchObject({ open: false, openAfterNavigation: false });
    });

    it("leads a chat page with no page before it back to Mingo's home", () => {
      setSurface({ activeDialogId: 'a' });
      render('/mingo/chat/');
      act(() => headerActions()[0].onClick());
      expect(nav.push).toHaveBeenCalledWith(routes.mingo.home);
    });

    it('offers no way back on the chat page before its chat is open', () => {
      useMingoSheetStore.setState({ lastPage: '/devices/' });
      render('/mingo/chat/');
      expect(headerActions()).toEqual([]);
    });

    it('raises a chat collapsed back to home over it, with both header actions', () => {
      setSurface({ activeDialogId: 'a' });
      const sheetNode = document.createElement('div');
      useMingoSheetStore.setState({ open: true, node: sheetNode });
      chips.onSend = null;
      render('/mingo/');
      expect(props().threadContainer).toBe(sheetNode);
      expect(headerActions().map(action => action.label)).toEqual(['Open as full chat', 'Back to page']);
      // The composer replies to the chat in the sheet: no quick actions for a new one.
      expect(chips.onSend).toBeNull();
      expect(selectDialog).not.toHaveBeenCalledWith(null);
    });
  });

  describe('a chat behind the page', () => {
    it('offers "Continue" at the start of the context strip, and says the reply continues it', () => {
      setSurface({ activeDialogId: 'a' });
      render('/devices/');
      expect(props().composerPlaceholder).toBe('Reply, or ask something else about this page…');
      const chip = renderLeading();
      expect(chip.textContent).toContain('Continue “chat”');

      act(() => chip.querySelector<HTMLButtonElement>('button:not([aria-label])')?.click());
      expect(useMingoSheetStore.getState().open).toBe(true);
      expect(props().composerContextLeading).toBeUndefined();
    });

    it('lets the chat go from its ×, so the next send from the page starts a new one', () => {
      setSurface({ activeDialogId: 'a' });
      render('/devices/');
      const chip = renderLeading();

      act(() => chip.querySelector<HTMLButtonElement>('[aria-label="Start a new chat instead"]')?.click());
      expect(panel.startNewChat).toHaveBeenCalledTimes(1);
      expect(useMingoSheetStore.getState().open).toBe(false);
    });

    it('offers nothing with no chat open, on home or on the chat page', () => {
      render('/devices/');
      expect(props().composerContextLeading).toBeUndefined();
      setSurface({ activeDialogId: 'a' });
      for (const pathname of ['/mingo/', '/mingo/chat/']) {
        render(pathname);
        expect(props().composerContextLeading).toBeUndefined();
      }
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

  it("lights the composer's edge on every route", () => {
    for (const path of ['/mingo/', '/devices/', '/mingo/chat/']) {
      render(path);
      expect(props().composerEdgeLight).toBe(true);
    }
  });

  it("shows the home chips' preview as ghost text in the composer", () => {
    render('/mingo/');
    expect(props().composerPreviewText).toBeNull();

    act(() => useComposerPreviewStore.getState().show('List every online machine'));
    expect(props().composerPreviewText).toBe('List every online machine');

    act(() => useComposerPreviewStore.getState().hide('List every online machine'));
    expect(props().composerPreviewText).toBeNull();
  });

  it('builds its chat with the props builder, through its own send', () => {
    render('/devices/');
    // Quick actions start their chat through the follow-wrapped send, not the raw one.
    expect(typeof builder.lastOptions?.sendInNewDialog).toBe('function');
    expect(builder.lastOptions?.sendInNewDialog).not.toBe(sendInNewDialog);
    // The state the chat sends through is the dock's wrapper around the session's.
    expect(props().mingoState).toMatchObject({ activeDialogId: null, sendMessage: expect.any(Function) });
    expect(props().mingoState).not.toHaveProperty('fromBuilder');
  });

  it("hands the chat page header the builder's dialog actions (Unarchive)", () => {
    useChatPageNodeStore.setState({ node: document.createElement('div') });
    render('/mingo/chat/');
    expect(props().mingoDialogCapabilities).toBe(CAPABILITIES);
  });

  describe('per route', () => {
    it('home: a new chat — its own prompt, the model row, the quick actions', () => {
      chips.onSend = null;
      render('/mingo/');
      expect(chips.onSend).toBeTypeOf('function');
      // The lib's default: the model row is on every route, so the composer keeps its height.
      expect(props().showModel).toBeUndefined();
      expect(props()).toMatchObject({
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

    it('chat: the 760px column and the model row', () => {
      setSurface({ activeDialogId: 'd-1' });
      render('/mingo/chat/');
      expect(props()).toMatchObject({ composerPlaceholder: 'Reply to Mingo…' });
      expect(props().showModel).toBeUndefined();
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
      ]) {
        render(pathname);
        expect(composerRouteOf(pathname)).toBe('full-width');
        expect(props()).toMatchObject({ contextMemory: undefined });
        expect(props().showModel).toBeUndefined();
      }
    });
  });

  describe("Compact: the chat's ⋯, not a button under the input", () => {
    it("hands the session's Compact to the chat's dialog actions", () => {
      setSurface({ activeDialogId: 'd-1' });
      render('/mingo/chat/');
      expect(builder.lastOptions).toMatchObject({ compactDialog });
      expect(props().composerFooterActions).toBeUndefined();
      expect(props().composerMenuItems).toBeUndefined();
    });

    it('hands none while the compact flag is off', () => {
      setSurface({ activeDialogId: 'd-1', compact: false });
      render('/mingo/chat/');
      expect(builder.lastOptions?.compactDialog).toBeUndefined();
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

  describe("under a page's action bar (a phone or a tablet)", () => {
    const section = () => container.querySelector('section');
    const widget = () => container.querySelector<HTMLButtonElement>('button');
    const foldButton = () => props().composerFooterActions as ReactElement<{ onClick: () => void }> | undefined;

    it('folds the composer into its button, still mounted', () => {
      bar.height = 96;
      render('/scripts/new/');
      expect(section()?.className).toContain('hidden');
      expect(widget()?.textContent).toBe('Ask Mingo');
      expect(panel.mounts).toBe(1);
    });

    it('opens it under the bar on a tap, with × to fold it back', () => {
      bar.height = 96;
      render('/scripts/new/');
      act(() => widget()?.click());
      expect(section()?.className).not.toContain('hidden');
      expect(widget()).toBeNull();

      act(() => foldButton()?.props.onClick());
      expect(section()?.className).toContain('hidden');
      expect(panel.mounts).toBe(1);
    });

    it('folds it again on a tap outside the chat, but not on one inside it or in its menus', () => {
      bar.height = 96;
      render('/scripts/new/');
      act(() => widget()?.click());

      const menu = document.createElement('div');
      menu.setAttribute('role', 'menu');
      document.body.appendChild(menu);
      act(() => {
        section()?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        menu.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      });
      expect(section()?.className).not.toContain('hidden');

      act(() => {
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      });
      expect(section()?.className).toContain('hidden');
      menu.remove();
    });

    it('starts folded on every page', () => {
      bar.height = 96;
      render('/scripts/new/');
      act(() => widget()?.click());
      render('/scripts/edit/');
      expect(section()?.className).toContain('hidden');
    });

    it('keeps the composer where there is no bar, on the chat page, and under the chat over the page', () => {
      render('/scripts/new/');
      expect(section()?.className).not.toContain('hidden');
      expect(foldButton()).toBeUndefined();

      bar.height = 96;
      setSurface({ activeDialogId: 'd-1' });
      render('/mingo/chat/');
      expect(section()?.className).not.toContain('hidden');

      useMingoSheetStore.setState({ open: true });
      render('/scripts/new/');
      expect(section()?.className).not.toContain('hidden');
      expect(foldButton()).toBeUndefined();
    });
  });

  describe('while the chat is not up', () => {
    it('holds its place with the composer, locked, before the session', () => {
      setSurface({ enabled: false });
      render('/devices/');

      expect(panel.props).toBeNull();
      expect(panel.loading).toMatchObject({ lock: { placeholder: 'Ask Mingo about this page…' } });
      expect(container.textContent).toBe('locked composer');
    });

    it('keeps it until the chat module has loaded, then hands over — and tells the chat page', () => {
      panel.loaded = false;
      render('/mingo/');
      expect(panel.loading).toMatchObject({ lock: { placeholder: 'Ask Mingo or describe a task…' } });
      expect(container.textContent).toContain('locked composer');
      expect(useChatPageNodeStore.getState().chatMounted).toBe(false);

      panel.loaded = true;
      render('/mingo/');
      expect(container.textContent).not.toContain('locked composer');
      expect(useChatPageNodeStore.getState().chatMounted).toBe(true);

      act(() => root.unmount());
      root = createRoot(container);
      expect(useChatPageNodeStore.getState().chatMounted).toBe(false);
    });
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

    it('Fix with Mingo: a new chat with the draft, in the composer under the page it was raised on', () => {
      render('/incidents/');
      const draft = { text: 'Fix the disk space incident' };
      act(() => useMingoLauncherStore.getState().draftToMingo(draft));

      expect(nav.push).not.toHaveBeenCalled();
      expect(panel.prefillDraft).toHaveBeenCalledTimes(1);
      expect(panel.prefillDraft).toHaveBeenCalledWith(draft);
      expect(useMingoLauncherStore.getState().dockRequest).toBeNull();
    });

    it('Fix with Mingo from a chat page: goes home, then the draft there', () => {
      render('/mingo/chat/');
      const draft = { text: 'Fix the disk space incident' };
      act(() => useMingoLauncherStore.getState().draftToMingo(draft));

      expect(nav.push).toHaveBeenCalledTimes(1);
      expect(nav.push).toHaveBeenCalledWith(routes.mingo.home);
      expect(panel.prefillDraft).not.toHaveBeenCalled();

      render('/mingo/');
      expect(panel.prefillDraft).toHaveBeenCalledWith(draft);
    });

    it('opens an existing chat over the page, home included, and on its own page from the chat page', () => {
      render('/devices/');
      act(() => useMingoLauncherStore.getState().openDialog('b'));
      expect(selectDialog).toHaveBeenCalledWith('b');
      expect(useMingoSheetStore.getState().open).toBe(true);
      expect(nav.push).not.toHaveBeenCalled();
      expect(useMingoLauncherStore.getState().dockRequest).toBeNull();

      act(() => useMingoSheetStore.setState({ open: false }));
      render('/mingo/');
      act(() => useMingoLauncherStore.getState().openDialog('c'));
      expect(selectDialog).toHaveBeenCalledWith('c');
      expect(useMingoSheetStore.getState().open).toBe(true);
      expect(nav.push).not.toHaveBeenCalled();

      act(() => useMingoSheetStore.setState({ open: false }));
      render('/mingo/chat/');
      act(() => useMingoLauncherStore.getState().openDialog('d'));
      expect(nav.push).toHaveBeenCalledWith(routes.mingo.chat('d'));
      expect(useMingoSheetStore.getState().open).toBe(false);
    });

    it('New chat from a chat page: home first, the reset only there — the page never draws the empty chat', () => {
      render('/mingo/chat/');
      act(() => useMingoLauncherStore.getState().startNewChat());

      expect(nav.push).toHaveBeenCalledWith(routes.mingo.home);
      expect(panel.startNewChat).not.toHaveBeenCalled();

      render('/mingo/');
      expect(panel.startNewChat).toHaveBeenCalledTimes(1);
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
      expect(useMingoLauncherStore.getState().dockRequest).toBeNull();
    });

    it('Generate with AI: the intent chat is created at once, from the page it was raised on', () => {
      render('/scripts/');
      act(() => useMingoLauncherStore.getState().startIntentChat('CREATE_SCRIPT'));
      expect(createIntentDialog).toHaveBeenCalledWith('CREATE_SCRIPT');
      expect(nav.push).not.toHaveBeenCalledWith(routes.mingo.home);
      expect(useMingoLauncherStore.getState().dockRequest).toBeNull();
    });
  });
});
