/**
 * The Manhattan v2 centre: which work-area columns show (plan D5, table T), the page
 * column's header per mode (matrix H), and the composer moving between the dock and the
 * chat column without remounting (plan C1: the draft survives).
 */

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act, type ReactNode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatPageNodeStore } from '@/app/components/mingo-shell/chat-page-node-store';
import { useMingoSheetStore } from '@/app/components/mingo-shell/mingo-sheet-store';
import {
  MANHATTAN_CHAT_CLOSED_SEED_ATTRIBUTE,
  MANHATTAN_CHAT_CLOSED_STORAGE_KEY,
} from '@/lib/navigation-sidebar-state';
import { ManhattanCentre } from './manhattan-centre';
import { useManhattanCentreStore, workAreaModeOf } from './manhattan-centre-store';
import { ManhattanComposerPortal, ManhattanComposerSlot, useManhattanComposerPlace } from './manhattan-composer-host';

const { nav, chatState, viewport } = vi.hoisted(() => ({
  nav: { pathname: '/devices', search: '', push: vi.fn() },
  chatState: { activeDialogId: null as string | null, messages: [] as unknown[] },
  /** `useMdUp()`: `undefined` until the media query answers, false on a phone. */
  viewport: { mdUp: true as boolean | undefined },
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMdUp: () => viewport.mdUp,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
// Start Work's blocks read Relay; the column only needs to draw it.
vi.mock('@/app/(app)/mingo/home/manhattan-start-work', () => ({
  ManhattanStartWork: ({ onWhatToAsk }: { onWhatToAsk?: () => void }) => (
    <button type="button" onClick={onWhatToAsk}>
      What to ask Mingo?
    </button>
  ),
}));
vi.mock('@/app/(app)/mingo/providers/mingo-chat-provider', () => ({
  useMingoChat: () => ({ chat: { state: chatState } }),
  useMingoChatThreadOnScreen: () => undefined,
}));

let container: HTMLDivElement;
let root: Root;

function render(node: ReactNode) {
  act(() => root.render(node));
}

/** A button by its accessible name (its `aria-label`, else its text). */
function button(name: string): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent) === name) ??
    null
  );
}

function click(name: string) {
  const target = button(name);
  if (!target) throw new Error(`no button "${name}"`);
  act(() => target.click());
}

const currentMode = () => container.querySelector('[data-testid="mode"]')?.textContent;

beforeEach(() => {
  nav.search = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  nav.pathname = '/devices';
  nav.push.mockReset();
  chatState.activeDialogId = null;
  chatState.messages = [];
  useManhattanCentreStore.setState({
    chatView: 'split',
    shownMode: null,
    whatToAskInColumn: false,
    compact: false,
    restoredDialogId: null,
  });
  useChatPageNodeStore.setState({ node: null, chatMounted: false, threadReady: false });
  viewport.mdUp = true;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.sessionStorage.clear();
  window.localStorage.clear();
  document.documentElement.removeAttribute(MANHATTAN_CHAT_CLOSED_SEED_ATTRIBUTE);
  vi.unstubAllGlobals();
});

describe('workAreaModeOf', () => {
  it.each([
    ['home', true, 'split', 'page'],
    // CU-17tkuw65znp: every page beside the chat column (Start Work when no chat is open).
    ['page', false, 'split', 'split'],
    ['page', true, 'split', 'split'],
    ['page', true, 'full', 'chat'],
    ['page', false, 'full', 'split'],
    ['page', true, 'hidden', 'page'],
    ['page', false, 'hidden', 'page'],
    ['full-width', true, 'split', 'split'],
    ['full-width', false, 'split', 'split'],
    ['full-width', true, 'full', 'chat'],
  ] as const)('%s, conversation %s, view %s → %s', (route, open, view, mode) => {
    expect(workAreaModeOf(route, open, view)).toBe(mode);
  });

  it('no chat for the session (the paywall): the page alone', () => {
    expect(workAreaModeOf('page', false, 'split', { chatEnabled: false })).toBe('page');
    expect(workAreaModeOf('full-width', true, 'split', { chatEnabled: false })).toBe('page');
  });

  it('compact: the chat over the page instead of beside it, never over a full-height page unasked', () => {
    const compact = { compact: true };
    expect(workAreaModeOf('page', true, 'split', compact)).toBe('chat');
    expect(workAreaModeOf('page', false, 'split', compact)).toBe('page');
    expect(workAreaModeOf('page', true, 'hidden', compact)).toBe('page');
    expect(workAreaModeOf('full-width', true, 'split', compact)).toBe('page');
    expect(workAreaModeOf('full-width', true, 'full', compact)).toBe('chat');
    expect(workAreaModeOf('home', true, 'split', compact)).toBe('page');
  });

  it('phone: the page alone, whatever the chat', () => {
    expect(workAreaModeOf('page', true, 'split', { phone: true })).toBe('page');
    expect(workAreaModeOf('page', true, 'full', { phone: true })).toBe('page');
  });

  it("a chat's own page: the chat column alone once the page lets the thread in (CU-17tkuw66n0m)", () => {
    const threadIn = { chatPageThread: true };
    expect(workAreaModeOf('chat', true, 'split', threadIn)).toBe('chat');
    // Whatever the view the pages left behind, and for a chat not created yet ("What to ask Mingo?").
    expect(workAreaModeOf('chat', true, 'hidden', threadIn)).toBe('chat');
    expect(workAreaModeOf('chat', false, 'split', threadIn)).toBe('chat');
    expect(workAreaModeOf('chat', true, 'split', { ...threadIn, compact: true })).toBe('chat');
    // Its skeleton or its own states (not found, failed): the page.
    expect(workAreaModeOf('chat', true, 'split')).toBe('page');
    // A phone's chat page holds the thread itself; behind the paywall there is no chat.
    expect(workAreaModeOf('chat', true, 'split', { ...threadIn, phone: true })).toBe('page');
    expect(workAreaModeOf('chat', true, 'split', { ...threadIn, chatEnabled: false })).toBe('page');
  });
});

describe('the composer host', () => {
  function Composer({ onMount }: { onMount: () => void }) {
    useEffect(onMount, [onMount]);
    // The slot holding it, as the dock reads it for its side inset (`useDockComposerInset`).
    const place = useManhattanComposerPlace();
    return (
      <>
        <textarea aria-label="Draft" />
        <output aria-label="place">{place}</output>
      </>
    );
  }
  function Host({ onMount }: { onMount: () => void }) {
    const [inColumn, setInColumn] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setInColumn(v => !v)}>
          move
        </button>
        <section aria-label="dock">
          <ManhattanComposerPortal>
            <Composer onMount={onMount} />
          </ManhattanComposerPortal>
          <ManhattanComposerSlot place="page" active={!inColumn} />
        </section>
        <section aria-label="column">
          <ManhattanComposerSlot place="column" active={inColumn} />
        </section>
      </>
    );
  }

  it('moves between the dock and the column with its draft, mounted once', () => {
    const onMount = vi.fn();
    render(<Host onMount={onMount} />);
    const dock = container.querySelector('[aria-label="dock"]');
    const column = container.querySelector('[aria-label="column"]');
    const draft = container.querySelector('textarea');
    if (!draft) throw new Error('no composer');
    draft.value = 'keep me';
    expect(dock?.contains(draft)).toBe(true);

    click('move');
    expect(column?.contains(draft)).toBe(true);
    expect(dock?.contains(draft)).toBe(false);

    click('move');
    expect(dock?.contains(container.querySelector('textarea'))).toBe(true);
    expect(container.querySelector('textarea')).toBe(draft);
    expect(draft.value).toBe('keep me');
    expect(onMount).toHaveBeenCalledOnce();
  });

  // CU-17tkuw68taa: the composer's side inset follows the slot it hangs in (none below 720px of content only in
  // the column, which pads it itself), so the place must follow every move, both ways.
  it('publishes the slot that holds it, on every move', () => {
    render(<Host onMount={() => {}} />);
    const place = () => container.querySelector('[aria-label="place"]')?.textContent;
    expect(place()).toBe('page');

    click('move');
    expect(place()).toBe('column');

    click('move');
    expect(place()).toBe('page');
  });
});

describe('ManhattanCentre', () => {
  function renderCentre(enabled = true) {
    render(
      <ManhattanCentre enabled={enabled}>
        {centre => (
          <>
            <p data-testid="mode">{centre ? centre.mode : 'off'}</p>
            {centre?.pageHeader}
          </>
        )}
      </ManhattanCentre>,
    );
  }

  it('hands nothing while off', () => {
    renderCentre(false);
    expect(currentMode()).toBe('off');
  });

  it('floats the dock over Start Work and a page alone, never beside the chat column', () => {
    let floats: ((route: boolean) => boolean) | undefined;
    const capture = () =>
      render(
        <ManhattanCentre enabled>
          {centre => {
            floats = centre?.dockFloats;
            return null;
          }}
        </ManhattanCentre>,
      );
    nav.pathname = '/mingo/';
    capture();
    expect(floats?.(false)).toBe(true);

    nav.pathname = '/devices';
    capture();
    // No chat open: Start Work is beside the page, the composer under it.
    expect(floats?.(true)).toBe(false);
    act(() => useManhattanCentreStore.setState({ chatView: 'hidden' }));
    capture();
    expect(floats?.(true)).toBe(true);
    chatState.activeDialogId = 'd-1';
    act(() => useManhattanCentreStore.setState({ chatView: 'split' }));
    capture();
    expect(floats?.(true)).toBe(false);
  });

  it('compact: a new page is shown, the chat waits behind it', () => {
    chatState.activeDialogId = 'd-1';
    const centre = () => (
      <ManhattanCentre enabled compact>
        {slots => <p data-testid="mode">{slots?.mode}</p>}
      </ManhattanCentre>
    );
    render(centre());
    expect(currentMode()).toBe('chat');
    nav.pathname = '/software';
    render(centre());
    expect(useManhattanCentreStore.getState().chatView).toBe('hidden');
    expect(currentMode()).toBe('page');
  });

  it('draws no page header in one column (compact): the top bar is the chrome', () => {
    chatState.activeDialogId = 'd-1';
    render(
      <ManhattanCentre enabled compact>
        {slots => <>{slots?.pageHeader}</>}
      </ManhattanCentre>,
    );
    expect(container.textContent).toBe('');
    expect(container.querySelector('button')).toBeNull();
  });

  it('says the page is hidden only while the chat covers it', () => {
    chatState.activeDialogId = 'd-1';
    let hidden: boolean | undefined;
    const centre = () => (
      <ManhattanCentre enabled>
        {slots => {
          hidden = slots?.pageHidden;
          return null;
        }}
      </ManhattanCentre>
    );
    render(centre());
    expect(hidden).toBe(false);
    act(() => useManhattanCentreStore.setState({ chatView: 'full' }));
    render(centre());
    expect(hidden).toBe(true);
  });

  it('remembers the page without a legacy mingoDialog param', () => {
    nav.pathname = '/devices/';
    nav.search = 'tab=all&mingoDialog=d-1';
    render(<ManhattanCentre enabled>{() => null}</ManhattanCentre>);
    expect(useMingoSheetStore.getState().outsidePage).toBe('/devices/?tab=all');
  });

  it.each([
    ['/mingo/archive/', 'Chat Archive'],
    ['/approvals/', 'Needs approval'],
  ])('titles %s, a page outside the navigation, %s', (pathname, title) => {
    nav.pathname = pathname;
    render(<ManhattanCentre enabled>{slots => <>{slots?.pageHeader}</>}</ManhattanCentre>);
    expect(container.textContent).toContain(title);
  });

  it('titles Start Work with no buttons', () => {
    nav.pathname = '/mingo/';
    renderCentre();
    expect(container.textContent).toContain('Start Work');
    expect(container.querySelector('button')).toBeNull();
  });

  it('hides the page header in CSS below two rails and the centre, so the first paint on a phone has none', () => {
    nav.pathname = '/mingo/';
    renderCentre();
    expect(container.querySelector('[data-column-header]')?.className).toContain('max-[911px]:hidden');
    nav.pathname = '/devices/';
    chatState.activeDialogId = 'd-1';
    renderCentre();
    expect(container.querySelector('[data-column-header]')?.className).toContain('max-[911px]:hidden');
  });

  it('draws no page header on a chat page (the chat header is its header), the chat column alone once the thread is in', () => {
    nav.pathname = '/mingo/chat/';
    chatState.activeDialogId = 'd-1';
    renderCentre();
    expect(currentMode()).toBe('page');
    expect(container.querySelector('button')).toBeNull();
    act(() => useChatPageNodeStore.setState({ threadReady: true }));
    expect(currentMode()).toBe('chat');
    expect(container.querySelector('button')).toBeNull();
  });

  it('in split: full screen hides the chat, close leaves the chat on its page', () => {
    chatState.activeDialogId = 'd-1';
    renderCentre();
    expect(currentMode()).toBe('split');
    expect(container.textContent).toContain('Devices');

    click('Close page');
    expect(nav.push).toHaveBeenCalledWith('/mingo/chat?id=d-1');

    click('Full screen page');
    expect(useManhattanCentreStore.getState().chatView).toBe('hidden');
    expect(currentMode()).toBe('page');
  });

  describe("the page's Back in the page header (CU-17tkuw670yr)", () => {
    /** The header and, under it, a page drawn through the lib's `PageLayout`, as `AppLayout` lays them out. */
    function renderPage(back?: { label?: string; onClick: () => void }, slots: { compact?: boolean } = {}) {
      render(
        <ManhattanCentre enabled compact={slots.compact}>
          {centre => (
            <>
              {centre?.pageHeader}
              <PageLayout title="Remote Session Recording" backButton={back}>
                <p>page</p>
              </PageLayout>
            </>
          )}
        </ManhattanCentre>,
      );
    }

    /** The page's own Back (the lib's `BackButton`, its label as text), outside the header. */
    const pageOwnBacks = () =>
      [...container.querySelectorAll('button')].filter(
        b => b.textContent?.includes('Back') && !b.closest('[data-column-header]'),
      );

    const headerBack = () => button('Back')?.closest('[data-column-header]') ?? null;

    it("a nested page: one Back, in the header, running the page's own handler", () => {
      nav.pathname = '/devices/details/remote-session/';
      chatState.activeDialogId = 'd-1';
      const back = vi.fn();
      renderPage({ label: 'Back', onClick: back });
      expect(headerBack()).not.toBeNull();
      expect(pageOwnBacks()).toHaveLength(0);
      click('Back');
      expect(back).toHaveBeenCalledOnce();
      // The chat stays beside the page.
      expect(useManhattanCentreStore.getState().chatView).toBe('split');
    });

    it('with the page full screen: still one Back, in the header', () => {
      nav.pathname = '/devices/details/remote-session/';
      chatState.activeDialogId = 'd-1';
      act(() => useManhattanCentreStore.setState({ chatView: 'hidden' }));
      renderPage({ label: 'Back', onClick: vi.fn() });
      expect(headerBack()).not.toBeNull();
      expect(pageOwnBacks()).toHaveLength(0);
    });

    it("a section's main page (no Back of its own): none in the header", () => {
      nav.pathname = '/devices/';
      renderPage(undefined);
      expect(button('Back')).toBeNull();
    });

    it('one column (compact): no page header, the page keeps its own Back', () => {
      nav.pathname = '/devices/details/remote-session/';
      chatState.activeDialogId = 'd-1';
      renderPage({ label: 'Back', onClick: vi.fn() }, { compact: true });
      expect(container.querySelector('[data-column-header]')).toBeNull();
      expect(pageOwnBacks()).toHaveLength(1);
    });

    it("Start Work and a chat's page draw no Back in the header: a title there keeps its own", () => {
      nav.pathname = '/mingo/';
      renderPage({ label: 'Back', onClick: vi.fn() });
      expect(headerBack()).toBeNull();
      expect(pageOwnBacks()).toHaveLength(1);
    });

    it('a phone: the page keeps its own Back', () => {
      nav.pathname = '/devices/details/remote-session/';
      viewport.mdUp = false;
      renderPage({ label: 'Back', onClick: vi.fn() });
      expect(container.querySelector('[data-column-header]')).toBeNull();
      expect(pageOwnBacks()).toHaveLength(1);
    });
  });

  it('alone with a chat waiting: brings it back beside the page', () => {
    chatState.activeDialogId = 'd-1';
    useManhattanCentreStore.setState({ chatView: 'hidden' });
    renderCentre();
    click('Show the chat beside the page');
    expect(currentMode()).toBe('split');
  });

  it('page full screen, "Close page": the chat on its page, never beside the page on the way', () => {
    chatState.activeDialogId = 'd-1';
    useManhattanCentreStore.setState({ chatView: 'hidden' });
    renderCentre();
    click('Close page');
    expect(nav.push).toHaveBeenCalledWith('/mingo/chat?id=d-1');
    // Until the chat's page is up, the page being left stays as it was: no split for a frame.
    expect(useManhattanCentreStore.getState().chatView).toBe('hidden');
    expect(currentMode()).toBe('page');

    nav.pathname = '/mingo/chat/';
    renderCentre();
    // On the chat's page the chat no longer waits: the next page shows it beside.
    expect(useManhattanCentreStore.getState().chatView).toBe('split');
    // Its skeleton, then the chat column alone once the page lets the thread in.
    expect(currentMode()).toBe('page');
    act(() => useChatPageNodeStore.setState({ threadReady: true }));
    expect(currentMode()).toBe('chat');
  });

  it.each(['hidden', 'full'] as const)("the user's view holds on a new page (%s)", view => {
    chatState.activeDialogId = 'd-1';
    useManhattanCentreStore.setState({ chatView: view });
    renderCentre();
    const mode = currentMode();
    expect(mode).not.toBe('split');
    nav.pathname = '/devices/details/remote-shell/';
    renderCentre();
    expect(useManhattanCentreStore.getState().chatView).toBe(view);
    expect(currentMode()).toBe(mode);
  });

  it('a chat closed beside the pages stays closed on the next one, until a chat opens', () => {
    useManhattanCentreStore.setState({ chatView: 'hidden' });
    renderCentre();
    expect(currentMode()).toBe('page');
    nav.pathname = '/software';
    renderCentre();
    expect(currentMode()).toBe('page');
    // A chat picked in the history, a notification, a first send from the composer under the page.
    chatState.activeDialogId = 'd-2';
    renderCentre();
    expect(useManhattanCentreStore.getState().chatView).toBe('split');
    expect(currentMode()).toBe('split');
  });

  describe('a closed chat column across a reload (CU-17tkuw66xzn)', () => {
    /** The window as `matchMedia` answers it: two columns from 912px. */
    function windowWide(wide: boolean) {
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: wide, media: query }));
    }
    const stored = () => window.localStorage.getItem(MANHATTAN_CHAT_CLOSED_STORAGE_KEY);

    it('stores a column closed on two columns, and forgets it on any other view', () => {
      const { setChatView } = useManhattanCentreStore.getState();
      setChatView('hidden');
      expect(stored()).toBe('true');
      // "Restore split", "Show chat", a chat opened: all land on `split`.
      setChatView('split');
      expect(stored()).toBeNull();
      setChatView('hidden');
      setChatView('full');
      expect(stored()).toBeNull();
      // Only this choice: nothing in the per-tab storage the view once used.
      expect(window.sessionStorage.length).toBe(0);
    });

    it("one column's own hidden stores nothing, and leaves a stored choice alone", () => {
      useManhattanCentreStore.setState({ compact: true });
      useManhattanCentreStore.getState().setChatView('hidden');
      expect(stored()).toBeNull();
      window.localStorage.setItem(MANHATTAN_CHAT_CLOSED_STORAGE_KEY, 'true');
      useManhattanCentreStore.getState().setChatView('split');
      expect(stored()).toBe('true');
    });

    it('comes back closed after a reload on two columns, and lets the seed mark go', () => {
      windowWide(true);
      window.localStorage.setItem(MANHATTAN_CHAT_CLOSED_STORAGE_KEY, 'true');
      document.documentElement.setAttribute(MANHATTAN_CHAT_CLOSED_SEED_ATTRIBUTE, '');
      renderCentre();
      expect(useManhattanCentreStore.getState().chatView).toBe('hidden');
      expect(currentMode()).toBe('page');
      expect(document.documentElement.hasAttribute(MANHATTAN_CHAT_CLOSED_SEED_ATTRIBUTE)).toBe(false);
    });

    it('nothing stored: the split after a reload', () => {
      windowWide(true);
      renderCentre();
      expect(useManhattanCentreStore.getState().chatView).toBe('split');
      expect(currentMode()).toBe('split');
    });

    /** The centre on a window of one column (`compact`) or two. */
    function renderAt(compact: boolean) {
      render(
        <ManhattanCentre enabled compact={compact}>
          {centre => <p data-testid="mode">{centre ? centre.mode : 'off'}</p>}
        </ManhattanCentre>,
      );
    }

    it('a narrow window at the reload keeps its own layout and the stored choice', () => {
      windowWide(false);
      window.localStorage.setItem(MANHATTAN_CHAT_CLOSED_STORAGE_KEY, 'true');
      document.documentElement.setAttribute(MANHATTAN_CHAT_CLOSED_SEED_ATTRIBUTE, '');
      renderAt(true);
      expect(useManhattanCentreStore.getState().chatView).toBe('split');
      expect(stored()).toBe('true');
      expect(document.documentElement.hasAttribute(MANHATTAN_CHAT_CLOSED_SEED_ATTRIBUTE)).toBe(false);
    });

    it('closed before a reload on a narrow window: the column stays closed once the window widens', () => {
      windowWide(false);
      window.localStorage.setItem(MANHATTAN_CHAT_CLOSED_STORAGE_KEY, 'true');
      renderAt(true);
      // The window widens to two columns: the same mounted centre, `compact` off.
      windowWide(true);
      renderAt(false);
      expect(useManhattanCentreStore.getState().chatView).toBe('hidden');
      expect(currentMode()).toBe('page');
      expect(stored()).toBe('true');
    });

    it("closed before a reload on a narrow window: one column's own hidden on a new page does not erase it", () => {
      windowWide(false);
      window.localStorage.setItem(MANHATTAN_CHAT_CLOSED_STORAGE_KEY, 'true');
      renderAt(true);
      // A new page in one column: the page shown, the chat behind it (the layout's `hidden`).
      nav.pathname = '/software';
      renderAt(true);
      expect(useManhattanCentreStore.getState().chatView).toBe('hidden');
      // The window widens to two columns: the same mounted centre, `compact` off.
      windowWide(true);
      renderAt(false);
      expect(useManhattanCentreStore.getState().chatView).toBe('hidden');
      expect(currentMode()).toBe('page');
      expect(stored()).toBe('true');
    });

    it('the centre switched off on a narrow window is no widening: the stored choice stays and waits', () => {
      windowWide(false);
      window.localStorage.setItem(MANHATTAN_CHAT_CLOSED_STORAGE_KEY, 'true');
      renderAt(true);
      nav.pathname = '/software';
      renderAt(true);
      render(
        <ManhattanCentre enabled={false} compact>
          {() => null}
        </ManhattanCentre>,
      );
      expect(useManhattanCentreStore.getState().chatView).toBe('hidden');
      expect(stored()).toBe('true');
    });

    it('a chat opened on a narrow window lets the stored closed column go', () => {
      windowWide(false);
      window.localStorage.setItem(MANHATTAN_CHAT_CLOSED_STORAGE_KEY, 'true');
      renderAt(true);
      chatState.activeDialogId = 'd-3';
      renderAt(true);
      expect(stored()).toBeNull();
      // The window widens to two columns: the same mounted centre, `compact` off.
      windowWide(true);
      renderAt(false);
      expect(useManhattanCentreStore.getState().chatView).toBe('split');
      expect(currentMode()).toBe('split');
    });

    it('the chat a reload brings back behind the page keeps the column closed; a chat opened after it opens it', () => {
      windowWide(true);
      window.localStorage.setItem(MANHATTAN_CHAT_CLOSED_STORAGE_KEY, 'true');
      renderCentre();
      // `useChatBehindPage` selects the tab's chat again once the list has loaded.
      useManhattanCentreStore.getState().setRestoredDialogId('d-1');
      chatState.activeDialogId = 'd-1';
      renderCentre();
      expect(currentMode()).toBe('page');
      expect(stored()).toBe('true');
      expect(useManhattanCentreStore.getState().restoredDialogId).toBeNull();
      // A chat picked in the history afterwards.
      chatState.activeDialogId = 'd-2';
      renderCentre();
      expect(currentMode()).toBe('split');
      expect(stored()).toBeNull();
    });
  });

  it('a link from the chat full screen to another detail page (a query change) shows it beside the chat', () => {
    chatState.activeDialogId = 'd-1';
    nav.pathname = '/devices/details/';
    nav.search = 'id=m-1';
    useManhattanCentreStore.setState({ chatView: 'full' });
    renderCentre();
    expect(currentMode()).toBe('chat');
    nav.search = 'id=m-2';
    renderCentre();
    expect(useManhattanCentreStore.getState().chatView).toBe('split');
    expect(currentMode()).toBe('split');
  });

  it('a link in the chat to the page already behind it shows that page (no URL change)', () => {
    chatState.activeDialogId = 'd-1';
    nav.pathname = '/devices/details/';
    nav.search = 'id=m-1';
    useManhattanCentreStore.setState({ chatView: 'full' });
    renderCentre();
    act(() => useManhattanCentreStore.getState().requestLinkedPage());
    renderCentre();
    expect(currentMode()).toBe('split');
  });

  it('one column: a link from the chat over the page shows the page instead of it', () => {
    chatState.activeDialogId = 'd-1';
    nav.pathname = '/devices/details/';
    nav.search = 'id=m-1';
    const centre = () => (
      <ManhattanCentre enabled compact>
        {slots => <p data-testid="mode">{slots?.mode}</p>}
      </ManhattanCentre>
    );
    render(centre());
    expect(currentMode()).toBe('chat');
    nav.search = 'id=m-2';
    render(centre());
    expect(currentMode()).toBe('page');
    act(() => useManhattanCentreStore.setState({ chatView: 'split' }));
    render(centre());
    expect(currentMode()).toBe('chat');
    act(() => useManhattanCentreStore.getState().requestLinkedPage());
    render(centre());
    expect(currentMode()).toBe('page');
  });

  it('a query change on the same page keeps the page full screen', () => {
    chatState.activeDialogId = 'd-1';
    useManhattanCentreStore.setState({ chatView: 'hidden' });
    renderCentre();
    nav.search = 'tab=software';
    renderCentre();
    expect(useManhattanCentreStore.getState().chatView).toBe('hidden');
  });

  it('widened out of one column: the chat comes back beside the page', () => {
    chatState.activeDialogId = 'd-1';
    const centre = (compact: boolean) => (
      <ManhattanCentre enabled compact={compact}>
        {slots => <p data-testid="mode">{slots?.mode}</p>}
      </ManhattanCentre>
    );
    render(centre(true));
    nav.pathname = '/software';
    render(centre(true));
    expect(currentMode()).toBe('page');
    render(centre(false));
    expect(useManhattanCentreStore.getState().chatView).toBe('split');
    expect(currentMode()).toBe('split');
  });

  it('widened out of one column: a chat the user closed stays closed', () => {
    chatState.activeDialogId = 'd-1';
    useManhattanCentreStore.setState({ chatView: 'hidden' });
    const centre = (compact: boolean) => (
      <ManhattanCentre enabled compact={compact}>
        {slots => <p data-testid="mode">{slots?.mode}</p>}
      </ManhattanCentre>
    );
    render(centre(false));
    render(centre(true));
    nav.pathname = '/software';
    render(centre(true));
    render(centre(false));
    expect(useManhattanCentreStore.getState().chatView).toBe('hidden');
    expect(currentMode()).toBe('page');
  });

  it('with no chat: Start Work beside the page; full screen, then back with the layout button', () => {
    renderCentre();
    expect(currentMode()).toBe('split');
    click('Full screen page');
    expect(currentMode()).toBe('page');
    click('Show the chat beside the page');
    expect(currentMode()).toBe('split');
    click('Close page');
    expect(nav.push).toHaveBeenCalledWith('/mingo');
  });

  it('behind the paywall: the page alone with no way to a chat', () => {
    render(
      <ManhattanCentre enabled chatEnabled={false}>
        {slots => (
          <>
            <p data-testid="mode">{slots?.mode}</p>
            {slots?.pageHeader}
          </>
        )}
      </ManhattanCentre>,
    );
    expect(currentMode()).toBe('page');
    expect(button('Show the chat beside the page')).toBeNull();
  });

  it('follows the work area: the page alone when it had no room for the split', () => {
    chatState.activeDialogId = 'd-1';
    let hidden: boolean | undefined;
    let report: ((shown: 'chat' | 'split' | 'page') => void) | undefined;
    const centre = () => (
      <ManhattanCentre enabled>
        {slots => {
          report = slots?.onShownModeChange;
          hidden = slots?.pageHidden;
          return slots?.pageHeader;
        }}
      </ManhattanCentre>
    );
    render(centre());
    expect(button('Full screen page')).not.toBeNull();
    act(() => report?.('page'));
    render(centre());
    expect(button('Full screen page')).toBeNull();
    expect(hidden).toBe(false);
  });

  describe('the chat column', () => {
    function renderColumn() {
      render(<ManhattanCentre enabled>{slots => <>{slots?.chatColumn}</>}</ManhattanCentre>);
    }
    const startWork = () => container.querySelector('[data-testid="manhattan-start-work-column"]');
    const thread = () => container.querySelector('[data-testid="manhattan-chat-thread"]');

    it('is Start Work with no conversation, the thread once a chat is open', () => {
      renderColumn();
      expect(startWork()?.classList.contains('hidden')).toBe(false);
      expect(thread()?.classList.contains('hidden')).toBe(true);
      chatState.activeDialogId = 'd-1';
      renderColumn();
      expect(startWork()?.classList.contains('hidden')).toBe(true);
      expect(thread()?.classList.contains('hidden')).toBe(false);
    });

    it("floats the composer over Start Work, as on Mingo's home; under a chat it takes its own band", () => {
      const dock = () => container.querySelector('[data-testid="manhattan-column-dock"]');
      renderColumn();
      expect(dock()?.classList.contains('absolute')).toBe(true);
      expect(dock()?.classList.contains('pointer-events-none')).toBe(true);
      chatState.activeDialogId = 'd-1';
      renderColumn();
      expect(dock()?.classList.contains('absolute')).toBe(false);
    });

    // CU-17tkuw69vdn: the column took the composer card to its own width (2000px in a full-screen chat). The card is
    // 800px at most there too: the composer's section only (the outermost in the slot), not the sections drawn inside
    // the chat, and its ground stays the column's.
    it.each([
      ['over Start Work', null],
      ['under an open chat', 'd-1'],
    ])('caps the composer card at 800px, centred in the column, %s', (_name, dialog) => {
      chatState.activeDialogId = dialog;
      renderColumn();
      const slot = container.querySelector('[data-testid="manhattan-column-dock"] > [data-composer-slot]');
      const classes = slot?.className.split(' ') ?? [];
      expect(classes).toContain(
        '[&_section:not(&_section_section)]:max-w-[calc(800px+2*var(--spacing-system-lf)+2*var(--spacing-system-m))]',
      );
      expect(classes).toContain('[&_section:not(&_section_section)]:px-[var(--spacing-system-lf)]');
      expect(classes.some(name => name.endsWith(':max-w-none'))).toBe(false);
      expect(classes.every(name => name.startsWith('[&_section:not(&_section_section)]:'))).toBe(true);
    });

    it('keeps the thread for a first send on its way (no chat id yet)', () => {
      chatState.messages = [{ id: 'm-1' }];
      renderColumn();
      expect(startWork()).toBeNull();
      expect(thread()?.classList.contains('hidden')).toBe(false);
    });

    it('keeps Start Work mounted once shown: through a hidden column and a chat opening (CU-17tkuw66n0m)', () => {
      renderColumn();
      const shown = startWork();
      expect(shown).not.toBeNull();
      act(() => useManhattanCentreStore.setState({ chatView: 'hidden' }));
      renderColumn();
      expect(startWork()).toBe(shown);
      act(() => useManhattanCentreStore.setState({ chatView: 'split' }));
      chatState.activeDialogId = 'd-1';
      renderColumn();
      expect(startWork()).toBe(shown);
      expect(shown?.classList.contains('hidden')).toBe(true);
    });

    it('mounts Start Work only once it is on screen', () => {
      useManhattanCentreStore.setState({ chatView: 'hidden' });
      renderColumn();
      expect(startWork()).toBeNull();
    });

    it("mounts no Start Work on a phone, whose first render reads as a desktop's", () => {
      viewport.mdUp = undefined;
      renderColumn();
      expect(startWork()).toBeNull();
      viewport.mdUp = false;
      renderColumn();
      expect(startWork()).toBeNull();
    });

    it('mounts Start Work on a desktop once the media query answers', () => {
      viewport.mdUp = undefined;
      renderColumn();
      expect(startWork()).toBeNull();
      viewport.mdUp = true;
      renderColumn();
      expect(startWork()).not.toBeNull();
    });

    it("is the thread on a chat's own page, a chat not created yet included", () => {
      nav.pathname = '/mingo/chat/';
      nav.search = 'view=what-to-ask';
      useChatPageNodeStore.setState({ threadReady: true });
      renderColumn();
      expect(startWork()).toBeNull();
      expect(thread()?.classList.contains('hidden')).toBe(false);
    });

    // CU-17tkuw6633f: set from the observer as a plain update, the padding rendered after the frame
    // was painted, and Start Work kept the old one under the column's composer for a frame.
    it("pads Start Work by the column dock's new height in the frame the dock changed in", () => {
      const observed: Array<{ target: Element; options?: ResizeObserverOptions; fire: () => void }> = [];
      let height = 120;
      vi.stubGlobal(
        'ResizeObserver',
        class {
          private readonly callback: ResizeObserverCallback;
          constructor(callback: ResizeObserverCallback) {
            this.callback = callback;
          }
          // As a browser delivers it: never on observe, later, from outside React.
          observe(target: Element, options?: ResizeObserverOptions) {
            observed.push({ target, options, fire: () => this.callback([], this) });
          }
          unobserve() {}
          disconnect() {}
        },
      );
      const offsetHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => height);
      try {
        renderColumn();
        const padded = () =>
          container.querySelector<HTMLElement>('[data-testid="manhattan-start-work-scroller"] > div')?.style
            .paddingBottom;
        const dock = container.querySelector('[data-testid="manhattan-column-dock"]');
        // Its border box, what `offsetHeight` reads.
        expect(observed.find(entry => entry.target === dock)?.options).toEqual({ box: 'border-box' });
        const fireDock = () => observed.find(entry => entry.target === dock)?.fire();
        // Outside `act`, as the browser delivers it: nothing else flushes React before the assertions.
        fireDock(); // the report on observe
        expect(padded()).toBe('120px');
        height = 168;
        fireDock();
        expect(padded()).toBe('168px');
      } finally {
        offsetHeight.mockRestore();
        vi.unstubAllGlobals();
      }
    });

    it('"Close Start Work" leaves the page alone', () => {
      renderColumn();
      click('Close Start Work');
      expect(useManhattanCentreStore.getState().chatView).toBe('hidden');
    });

    it('"What to ask Mingo?" answers in the column until a pick opens a chat', () => {
      renderColumn();
      click('What to ask Mingo?');
      expect(useManhattanCentreStore.getState().whatToAskInColumn).toBe(true);
      expect(startWork()?.classList.contains('hidden')).toBe(true);
      chatState.activeDialogId = 'd-new';
      renderColumn();
      expect(useManhattanCentreStore.getState().whatToAskInColumn).toBe(false);
    });
  });
});
