/**
 * The Mingo-first composer dock: the session's one `EmbeddableChat`, drawing the session's
 * one engine (`ChatEngineProvider`), laid out per route: the thread portalled into the
 * chat page's node (an element there, `null` everywhere else, never `undefined`), no
 * memory strip on full-width pages; plus the launcher drain, the locked composer that
 * holds its place while the chat loads, and its own crash fallback.
 */

import { act, forwardRef, type ReactNode, useEffect, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { routes } from '@/lib/routes';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { useManhattanCentreStore } from '../manhattan-shell/manhattan-centre-store';
import { ManhattanDockContext } from '../manhattan-shell/manhattan-dock-context';
import { useChatPageNodeStore } from './chat-page-node-store';
import { MingoComposerDock } from './mingo-composer-dock';
import { composerRouteOf, dockViewOf } from './mingo-dock-route';
import { useMingoSheetStore } from './mingo-sheet-store';

const {
  panel,
  nav,
  surface,
  builder,
  shell,
  identity,
  chips,
  viewport,
  tour,
  CONTEXT_MEMORY,
  RENDER_MENTION,
  RENDER_CONTEXT_ITEM,
} = vi.hoisted(() => ({
  panel: {
    props: null as Record<string, unknown> | null,
    /** The engine the dock provided around the chat (`ChatEngineProvider`). */
    engine: null as unknown,
    mounts: 0,
    /** The thread portalled into `threadContainer` mounted: once per container it lands in. */
    threadMounts: 0,
    /** The chat module has loaded: the handle exists. */
    loaded: true,
    /** The locked composer's props, while it draws. */
    loading: null as Record<string, unknown> | null,
    startNewChat: vi.fn(),
    showWhatToAsk: vi.fn(),
    prefillDraft: vi.fn(),
    focusComposer: vi.fn(),
  },
  nav: { pathname: '/devices/', search: '', push: vi.fn() },
  surface: { value: null as unknown },
  builder: { lastOptions: null as Record<string, unknown> | null },
  shell: { mobile: false },
  identity: { enabled: null as boolean | null },
  chips: { onSend: null as ((text: string) => void) | null },
  /** `useMdUp()`: false on a phone. */
  viewport: { mdUp: true as boolean | undefined },
  /** What the dock handed the tour: where its conversation is on screen, and the block's ×. */
  tour: { input: null as { onScreen?: boolean; onClose?: () => void } | null },
  CONTEXT_MEMORY: { items: [{ type: 'DEVICE', id: 'm-1', label: 'web-01' }], onRemove: () => {} },
  RENDER_MENTION: () => null,
  RENDER_CONTEXT_ITEM: () => null,
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => {
  function FakeThread() {
    useEffect(() => {
      panel.threadMounts += 1;
    }, []);
    return null;
  }
  return {
    EmbeddableChat: forwardRef<unknown, Record<string, unknown>>(function FakeEmbeddableChat(props, ref) {
      const { loaded } = panel;
      useImperativeHandle(
        ref,
        () =>
          loaded
            ? {
                startNewChat: panel.startNewChat,
                prefillDraft: panel.prefillDraft,
                showWhatToAsk: panel.showWhatToAsk,
                focusComposer: panel.focusComposer,
              }
            : null,
        [loaded],
      );
      useEffect(() => {
        panel.mounts += 1;
      }, []);
      panel.props = props;
      // As the real chat does: the thread portals into its container, so a new container is a
      // new thread (React remounts a portal whose container changes).
      const container = props.threadContainer;
      return container instanceof HTMLElement ? createPortal(<FakeThread />, container) : null;
    }),
    ChatEngineProvider: ({ children, engine }: { children: ReactNode; engine: unknown }) => {
      panel.engine = engine;
      return children;
    },
    ChatIdentityProvider: ({ children, enabled }: { children: ReactNode; enabled: boolean }) => {
      identity.enabled = enabled;
      return children;
    },
    ChatComposer: (props: Record<string, unknown>) => {
      panel.loading = props;
      return <p>locked composer</p>;
    },
    ModelDisplay: () => null,
  };
});
vi.mock('@flamingo-stack/openframe-frontend-core/components', () => ({
  LoadingRegion: ({ children }: { children: ReactNode }) => <div aria-busy="true">{children}</div>,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/icons-v2', () => ({
  Chevron02UpIcon: () => null,
  MessageTextIcon: () => null,
  PackageCheckIcon: () => null,
  Refresh01RightIcon: () => null,
  Collapse02Icon: () => null,
  Expand01Icon: () => null,
  Expand02Icon: () => null,
  XmarkIcon: () => null,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', () => ({
  Button: ({ children, onClick, ...rest }: { children: ReactNode; onClick?: () => void; 'aria-label'?: string }) => (
    <button type="button" onClick={onClick} aria-label={rest['aria-label']}>
      {children}
    </button>
  ),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useMdUp: () => viewport.mdUp }));
vi.mock('@flamingo-stack/openframe-frontend-core/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push }),
}));
vi.mock('@/lib/platform', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isMobileShell: () => shell.mobile,
}));
vi.mock('@/app/(app)/mingo/providers/mingo-chat-provider', () => ({
  useMingoChatSurface: () => surface.value,
}));
// The chips have tests of their own; here: where they show and what a click does.
vi.mock('./mingo-dock-quick-actions', () => ({
  MingoDockQuickActions: ({ onSend }: { onSend: (text: string) => void }) => {
    chips.onSend = onSend;
    return null;
  },
}));
// The tour has tests of its own (and its Relay reads need the compiler): no tour here,
// the state passes through.
vi.mock('@/app/(app)/mingo/tour/use-mingo-tour', () => ({
  useMingoTour: (input: { state: unknown; onScreen?: boolean; onClose?: () => void }) => {
    tour.input = input;
    return { state: input.state, aboveComposer: null };
  },
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
const pageChip = vi.hoisted(() => ({ node: null as ReactNode }));
vi.mock('./use-page-chip', () => ({ usePageChip: () => pageChip.node }));
// The props builder has tests of its own; here: what the dock asks of it.
vi.mock('./use-openframe-chat-props', () => ({
  useOpenframeChatProps: (options: Record<string, unknown>) => {
    builder.lastOptions = options;
    return {
      contextMemory: CONTEXT_MEMORY,
      contextPicker: { fromBuilder: true },
      renderRecordChip: RENDER_MENTION,
      renderContextItem: RENDER_CONTEXT_ITEM,
    };
  },
}));

/** The engine's one way to start a chat: a prompt sent at once, or an intent. */
const startNewDialog = vi.fn(async (_options?: { prompt?: string; intent?: string; title?: string }) => null);
const selectDialog = vi.fn();
/** The session's thread handlers: the dock must hand them to the chat untouched. */
const loadMoreMessages = vi.fn();
const actions = {
  approve: vi.fn(),
  reject: vi.fn(),
  approveEscalation: vi.fn(),
  rejectEscalation: vi.fn(),
  pickSuggestion: vi.fn(),
  selectAsk: vi.fn(),
};
const displayApprovalTypes = ['CLIENT'];
const stopMessage = vi.fn();

function setSurface({
  activeDialogId = null as string | null,
  enabled = true,
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
            actions,
            displayApprovalTypes,
            stopMessage,
            startNewDialog,
          },
        },
    error,
    enabled,
    identityEnabled,
  };
}

let container: HTMLDivElement;
let root: Root;

function render(href: string) {
  const [pathname, search = ''] = href.split('?');
  nav.pathname = pathname;
  nav.search = search;
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
    panel.engine = null;
    panel.mounts = 0;
    panel.threadMounts = 0;
    panel.loaded = true;
    panel.loading = null;
    pageChip.node = null;
    builder.lastOptions = null;
    shell.mobile = false;
    identity.enabled = null;
    setSurface();
    // A published node is a page that has let the thread in, unless a test says otherwise.
    useChatPageNodeStore.setState({ node: null, chatMounted: false, threadReady: true });
    useFeatureFlagsStore.getState().reset();
    useMingoLauncherStore.setState({ dockMounted: false, dockRequest: null });
    useMingoSheetStore.setState({
      open: false,
      openAfterNavigation: false,
      node: null,
      lastPage: null,
      outsidePage: null,
    });
    viewport.mdUp = true;
    tour.input = null;
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

    it('raises a chat not created yet over home (collapsed from "What to ask Mingo?"), with only a way back', () => {
      const sheetNode = document.createElement('div');
      useMingoSheetStore.setState({ open: true, node: sheetNode });
      render('/mingo/');
      expect(props().threadContainer).toBe(sheetNode);
      expect(headerActions().map(action => action.label)).toEqual(['Back to page']);
      act(() => headerActions()[0].onClick());
      expect(useMingoSheetStore.getState().open).toBe(false);
    });

    it('takes "What to ask Mingo?" to its own page, the full chat, which shows it on arrival', () => {
      render('/devices/');
      act(() => useMingoLauncherStore.getState().showWhatToAsk());
      expect(nav.push).toHaveBeenCalledWith(routes.mingo.whatToAsk);
      expect(useMingoLauncherStore.getState().dockRequest).toBeNull();
      expect(useMingoSheetStore.getState().open).toBe(false);
      expect(panel.showWhatToAsk).not.toHaveBeenCalled();

      render(routes.mingo.whatToAsk);
      expect(panel.showWhatToAsk).toHaveBeenCalledTimes(1);
      // Once per visit, not once per render.
      render(routes.mingo.whatToAsk);
      expect(panel.showWhatToAsk).toHaveBeenCalledTimes(1);
    });

    it('shows a fresh set when asked again on its page, and again on every visit', () => {
      render(routes.mingo.whatToAsk);
      act(() => useMingoLauncherStore.getState().showWhatToAsk());
      expect(panel.showWhatToAsk).toHaveBeenCalledTimes(2);
      expect(nav.push).not.toHaveBeenCalled();

      // A pick creates the chat and the page becomes its page; a later visit asks anew.
      render(`${routes.mingo.chat('a')}`);
      render(routes.mingo.whatToAsk);
      expect(panel.showWhatToAsk).toHaveBeenCalledTimes(3);
    });

    it('takes "What to ask Mingo?" from a chat page to its own page too', () => {
      setSurface({ activeDialogId: 'a' });
      render(routes.mingo.chat('a'));
      act(() => useMingoLauncherStore.getState().showWhatToAsk());
      expect(nav.push).toHaveBeenCalledWith(routes.mingo.whatToAsk);
      expect(panel.showWhatToAsk).not.toHaveBeenCalled();
    });

    it('leads "What to ask Mingo?" back to the last page before its chat exists', () => {
      useMingoSheetStore.setState({ lastPage: '/devices/' });
      render(routes.mingo.whatToAsk);
      expect(headerActions().map(action => action.label)).toEqual(['Back to page', 'Close chat']);
      act(() => headerActions()[1].onClick());
      expect(nav.push).toHaveBeenCalledWith('/devices/');
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

  describe("the Getting Started block's ×", () => {
    const closeBlock = () => act(() => tour.input?.onClose?.());

    it('closes the sheet over a page, where the tour chat is on screen', () => {
      setSurface({ activeDialogId: 'a' });
      useMingoSheetStore.setState({ open: true, node: document.createElement('div') });
      render('/devices/');
      expect(tour.input?.onScreen).toBe(true);

      closeBlock();
      expect(useMingoSheetStore.getState().open).toBe(false);
      expect(nav.push).not.toHaveBeenCalled();
    });

    it('leaves a page as it is behind the chat: only the block goes', () => {
      setSurface({ activeDialogId: 'a' });
      render('/devices/');
      expect(tour.input?.onScreen).toBe(false);

      closeBlock();
      expect(useMingoSheetStore.getState().open).toBe(false);
      expect(nav.push).not.toHaveBeenCalled();
    });

    it('closes the chat page to the last page, as "Close chat" does', () => {
      setSurface({ activeDialogId: 'a' });
      useMingoSheetStore.setState({ lastPage: '/devices/?statuses=ONLINE' });
      render('/mingo/chat/');
      expect(tour.input?.onScreen).toBe(true);

      closeBlock();
      expect(nav.push).toHaveBeenCalledWith('/devices/?statuses=ONLINE');
      expect(useMingoSheetStore.getState()).toMatchObject({ open: false, openAfterNavigation: false });
    });

    it("closes a phone's chat page to the last page outside Mingo, as the top bar's × does", () => {
      viewport.mdUp = false;
      setSurface({ activeDialogId: 'a' });
      useMingoSheetStore.setState({ lastPage: '/devices/', outsidePage: '/tickets/' });
      render('/mingo/chat/');

      closeBlock();
      expect(nav.push).toHaveBeenCalledWith('/tickets/');
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

  it('sends a quick action at once, in a new chat', () => {
    render('/mingo/');
    act(() => chips.onSend?.('List every online machine'));
    expect(startNewDialog).toHaveBeenCalledWith({ prompt: 'List every online machine' });
    expect(panel.prefillDraft).not.toHaveBeenCalled();
  });

  it('leaves the keyboard in the composer after a quick action: its row goes away with the send', () => {
    render('/mingo/');
    act(() => chips.onSend?.('List every online machine'));
    expect(panel.focusComposer).toHaveBeenCalledTimes(1);
  });

  it("draws the session's engine as it is, and is told of the panel's sends", () => {
    render('/devices/');
    const { chat } = surface.value as { chat: { state: unknown } };
    expect(panel.engine).toBe(chat.state);
    expect(props()).not.toHaveProperty('mingoState');
    expect(props()).not.toHaveProperty('mingoDialogCapabilities');
    expect(props().onMessageSent).toEqual(expect.any(Function));
    expect(props()).toMatchObject({ contextPicker: { fromBuilder: true } });
    expect(builder.lastOptions).toHaveProperty('dialogStatusOf');
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
      expect(container.querySelector('section')?.className).toContain('max-w-[880px]');
    });

    it('no other page carries the quick actions, a full-width one included', () => {
      for (const pathname of ['/devices/', '/devices/details/file-manager/']) {
        chips.onSend = null;
        render(pathname);
        expect(chips.onSend).toBeNull();
      }
    });

    it('the chat page carries none: its new chat draws them in its empty state', () => {
      chips.onSend = null;
      setSurface({ activeDialogId: 'd-1' });
      render('/mingo/chat/');
      expect(chips.onSend).toBeNull();
    });

    it('chat: the 760px column and the model row', () => {
      setSurface({ activeDialogId: 'd-1' });
      render('/mingo/chat/');
      expect(props()).toMatchObject({ composerPlaceholder: 'Reply to Mingo…' });
      expect(props().showModel).toBeUndefined();
      expect(container.querySelector('section')?.className).toContain('max-w-[760px]');
    });

    it('any other page: about this page, the memory strip and the model row', () => {
      render('/customers/details/');
      expect(props().showModel).toBeUndefined();
      expect(props()).toMatchObject({
        composerPlaceholder: 'Ask Mingo about this page…',
        contextMemory: CONTEXT_MEMORY,
      });
      expect(container.querySelector('section')?.className).toContain('max-w-[880px]');
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

  describe('Manhattan v2: the chat column beside every page', () => {
    const columnNode = document.createElement('div');
    function renderV2(href: string) {
      const [pathname, search = ''] = href.split('?');
      nav.pathname = pathname;
      nav.search = search;
      act(() =>
        root.render(
          <ManhattanDockContext.Provider value>
            <MingoComposerDock />
          </ManhattanDockContext.Provider>,
        ),
      );
    }
    beforeEach(() => {
      chips.onSend = null;
      useManhattanCentreStore.setState({
        chatView: 'split',
        compact: false,
        shownMode: null,
        whatToAskInColumn: false,
        threadNode: columnNode,
      });
    });

    it('with no chat open, Start Work holds the column: no thread portalled, a new chat composer, the quick actions', () => {
      renderV2('/devices/');
      expect(props().threadContainer).toBeNull();
      expect(props().composerPlaceholder).toBe(dockViewOf('home').placeholder);
      expect(chips.onSend).not.toBeNull();
    });

    it('a full-height page has the chat beside it too', () => {
      setSurface({ activeDialogId: 'd-1' });
      renderV2('/devices/details/remote-shell/?id=m-1');
      expect(props().threadContainer).toBe(columnNode);
    });

    it('"Close chat" beside a page lets the chat go and leaves the page alone', () => {
      setSurface({ activeDialogId: 'd-1' });
      renderV2('/devices/');
      expect(props().threadContainer).toBe(columnNode);
      const close = headerActions().find(action => action.label === 'Close chat');
      if (!close) throw new Error('no Close chat');
      act(() => close.onClick());
      expect(panel.startNewChat).toHaveBeenCalledOnce();
      expect(useManhattanCentreStore.getState().chatView).toBe('hidden');
    });

    it('answers Start Work\'s "What to ask Mingo?" in the column, once per request', () => {
      renderV2('/devices/');
      act(() => useManhattanCentreStore.setState({ whatToAskInColumn: true }));
      expect(panel.showWhatToAsk).toHaveBeenCalledOnce();
      expect(props().threadContainer).toBe(columnNode);
      renderV2('/devices/');
      expect(panel.showWhatToAsk).toHaveBeenCalledOnce();
    });

    describe("a chat's own page (CU-17tkuw66n0m)", () => {
      const pageNode = document.createElement('div');

      it('shows the thread beside a page and on the chat page in one column node: it never remounts', () => {
        setSurface({ activeDialogId: 'd-1' });
        useChatPageNodeStore.setState({ node: null, threadReady: false });
        renderV2('/devices/');
        expect(props().threadContainer).toBe(columnNode);
        // "Close page" goes here: the chat page lets the thread in one commit after it arrives
        // (its layout effect). The thread waits in the column meanwhile.
        useChatPageNodeStore.setState({ node: pageNode });
        renderV2('/mingo/chat/?id=d-1');
        expect(props().threadContainer).toBe(columnNode);
        act(() => useChatPageNodeStore.setState({ threadReady: true }));
        expect(props().threadContainer).toBe(columnNode);
        act(() => useChatPageNodeStore.setState({ node: null, threadReady: false }));
        renderV2('/devices/');
        expect(props().threadContainer).toBe(columnNode);
        expect(panel.threadMounts).toBe(1);
      });

      it("from Mingo's home, lets the thread into the column once the page lets it in, never into the page", () => {
        setSurface({ activeDialogId: 'd-1' });
        useChatPageNodeStore.setState({ node: null, threadReady: false });
        renderV2('/mingo/');
        expect(props().threadContainer).toBeNull();
        useChatPageNodeStore.setState({ node: pageNode });
        renderV2('/mingo/chat/?id=d-1');
        // The page's skeleton is up (the page column): no thread behind it yet.
        expect(props().threadContainer).toBeNull();
        act(() => useChatPageNodeStore.setState({ threadReady: true }));
        expect(props().threadContainer).toBe(columnNode);
        expect(panel.threadMounts).toBe(1);
      });

      it('on a phone keeps the thread on the chat page itself', () => {
        viewport.mdUp = false;
        setSurface({ activeDialogId: 'd-1' });
        useChatPageNodeStore.setState({ node: pageNode, threadReady: true });
        renderV2('/mingo/chat/?id=d-1');
        expect(props().threadContainer).toBe(pageNode);
      });

      it("the tour block's × leaves the chat page, as the chat's own close does", () => {
        setSurface({ activeDialogId: 'd-1' });
        useMingoSheetStore.setState({ lastPage: '/devices/' });
        useChatPageNodeStore.setState({ node: pageNode, threadReady: true });
        renderV2('/mingo/chat/?id=d-1');
        act(() => tour.input?.onClose?.());
        expect(nav.push).toHaveBeenCalledWith('/devices/');
        expect(useManhattanCentreStore.getState().chatView).toBe('split');
      });
    });
  });

  // Compact is the engine's dialog action (the chat's ⋯), never a button under the input.
  it('puts no Compact under the input', () => {
    setSurface({ activeDialogId: 'd-1' });
    render('/mingo/chat/');
    expect(props().composerFooterActions).toBeUndefined();
    expect(props().composerMenuItems).toBeUndefined();
  });

  // MISSING 3.6-3.8: the thread on the chat page is the session's, with everything the
  // classic panel drew in it.
  it("portals the session's thread: mention and context chips, paging, Stop", () => {
    useChatPageNodeStore.setState({ node: document.createElement('div') });
    setSurface({ activeDialogId: 'd-1' });
    render('/mingo/chat/');
    expect(props()).toMatchObject({
      renderRecordChip: RENDER_MENTION,
      renderContextItem: RENDER_CONTEXT_ITEM,
    });
    expect(panel.engine).toMatchObject({
      activeDialogId: 'd-1',
      hasMoreMessages: true,
      loadMoreMessages,
      actions,
      displayApprovalTypes,
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

  // Figma `chat/dock` (node 4368:14042): the page's background under the composer across the
  // column, and a fade into it over the page above, on every page.
  it.each(['/devices/', '/mingo/', '/scripts/new/'])('lays the composer on its ground on %s', pathname => {
    render(pathname);
    const ground = container.querySelector('[data-testid="mingo-composer-dock-ground"]');
    const classes = ground?.className.split(' ') ?? [];
    expect(classes).toEqual(
      expect.arrayContaining([
        'bg-ods-bg',
        'pointer-events-auto',
        'before:bottom-full',
        'before:h-[var(--spacing-system-xlf)]',
        'before:from-transparent',
        'before:to-ods-bg',
        'before:pointer-events-none',
      ]),
    );
    // The ground spans the column; the composer is centred on it at the route's width.
    expect(ground?.querySelector('section')?.className).toContain('mx-auto');
  });

  describe('on a phone', () => {
    // The ground, which the phone rule hides with the composer on it.
    const section = () => container.querySelector('[data-testid="mingo-composer-dock-ground"]');

    it('draws no composer under a page, below md only, still mounted', () => {
      viewport.mdUp = false;
      render('/scripts/new/');
      expect(section()?.className).toContain('max-md:hidden');
      expect(section()?.className.split(' ')).not.toContain('hidden');
      render('/devices/details/remote-desktop/');
      expect(section()?.className).toContain('max-md:hidden');
      expect(panel.mounts).toBe(1);
    });

    it("keeps it on Mingo's home, the chat page and under the chat over the page", () => {
      render('/mingo/');
      expect(section()?.className).not.toContain('max-md:hidden');

      setSurface({ activeDialogId: 'd-1' });
      render('/mingo/chat/');
      expect(section()?.className).not.toContain('max-md:hidden');

      useMingoSheetStore.setState({ open: true });
      render('/scripts/new/');
      expect(section()?.className).not.toContain('max-md:hidden');
    });

    it("stays under v2's chat list, a panel over the page and its scrim (the composer does not step out)", () => {
      nav.pathname = '/mingo/';
      nav.search = '';
      act(() =>
        root.render(
          <ManhattanDockContext.Provider value>
            <MingoComposerDock />
          </ManhattanDockContext.Provider>,
        ),
      );
      expect(section()?.className).not.toContain('max-md:hidden');
      act(() => useMingoSheetStore.getState().showList());
      expect(section()?.className).not.toContain('max-md:hidden');
      act(() => useMingoSheetStore.getState().hideList());
      expect(section()?.className).not.toContain('max-md:hidden');
    });

    it('takes a draft to a new chat, where it has no composer of its own', () => {
      viewport.mdUp = false;
      render('/incidents/');
      act(() => useMingoLauncherStore.getState().draftToMingo({ text: 'Fix the disk space incident' }));
      expect(nav.push).toHaveBeenCalledWith(routes.mingo.home);
      expect(panel.prefillDraft).not.toHaveBeenCalled();
      render('/mingo/');
      expect(panel.prefillDraft).toHaveBeenCalledTimes(1);
      expect(useMingoSheetStore.getState().open).toBe(false);
    });

    it('opens a chat on its page, never over the page', () => {
      viewport.mdUp = false;
      render('/devices/');
      act(() => useMingoLauncherStore.getState().openDialog('d-7'));
      expect(nav.push).toHaveBeenCalledWith(routes.mingo.chat('d-7'));
      expect(selectDialog).not.toHaveBeenCalled();
      expect(useMingoSheetStore.getState().open).toBe(false);
    });

    it("draws no actions in the chat header: the top bar's Mingo button is its ×", () => {
      viewport.mdUp = false;
      setSurface({ activeDialogId: 'a' });
      useMingoSheetStore.setState({ lastPage: '/devices/' });
      render('/mingo/chat/');
      expect(props().threadHeaderActions).toBeUndefined();
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

    it("heads the locked composer with the page's chip, as the chat will: the dock does not grow when it lands", () => {
      setSurface({ enabled: false });
      pageChip.node = <span>Devices</span>;
      render('/devices/');
      const node = document.createElement('div');
      container.appendChild(node);
      const leadingRoot = createRoot(node);
      leadingRoots.push(leadingRoot);
      act(() => leadingRoot.render(panel.loading?.contextLeading as ReactNode));
      expect(node.textContent).toBe('Devices');
    });

    it('is its loading form while the landing page is held, with no chat running', () => {
      nav.pathname = '/mingo/';
      nav.search = '';
      act(() => root.render(<MingoComposerDock held />));
      expect(panel.props).toBeNull();
      expect(panel.loading).toMatchObject({ lock: { placeholder: 'Ask Mingo or describe a task…' } });
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
      // The composer is on screen: nothing rises over the page.
      expect(useMingoSheetStore.getState().open).toBe(false);
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
      expect(startNewDialog).toHaveBeenCalledWith({ prompt: 'What can you do?' });
      expect(useMingoLauncherStore.getState().dockRequest).toBeNull();
    });

    it('Generate with AI: the intent chat is created at once, from the page it was raised on', () => {
      render('/scripts/');
      act(() => useMingoLauncherStore.getState().startIntentChat('CREATE_SCRIPT'));
      expect(startNewDialog).toHaveBeenCalledWith({ intent: 'CREATE_SCRIPT' });
      expect(nav.push).not.toHaveBeenCalledWith(routes.mingo.home);
      expect(useMingoLauncherStore.getState().dockRequest).toBeNull();
    });
  });
});
