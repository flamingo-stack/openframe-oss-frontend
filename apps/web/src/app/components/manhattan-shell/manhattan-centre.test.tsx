/**
 * The Manhattan v2 centre: which work-area columns show (plan D5, table T), the page
 * column's header per mode (matrix H), and the composer moving between the dock and the
 * chat column without remounting (plan C1: the draft survives).
 */

import { act, type ReactNode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoSheetStore } from '@/app/components/mingo-shell/mingo-sheet-store';
import { ManhattanCentre } from './manhattan-centre';
import { useManhattanCentreStore, workAreaModeOf } from './manhattan-centre-store';
import { ManhattanComposerPortal, ManhattanComposerSlot } from './manhattan-composer-host';

const { nav, chatState } = vi.hoisted(() => ({
  nav: { pathname: '/devices', search: '', push: vi.fn() },
  chatState: { activeDialogId: null as string | null, messages: [] as unknown[] },
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
  useManhattanCentreStore.setState({ chatView: 'split', shownMode: null, whatToAskInColumn: false });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.sessionStorage.clear();
});

describe('workAreaModeOf', () => {
  it.each([
    ['home', true, 'split', 'page'],
    ['chat', true, 'split', 'page'],
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
    expect(workAreaModeOf('page', false, 'split', false, false, false)).toBe('page');
    expect(workAreaModeOf('full-width', true, 'split', false, false, false)).toBe('page');
  });

  it('compact: the chat over the page instead of beside it, never over a full-height page unasked', () => {
    expect(workAreaModeOf('page', true, 'split', true)).toBe('chat');
    expect(workAreaModeOf('page', false, 'split', true)).toBe('page');
    expect(workAreaModeOf('page', true, 'hidden', true)).toBe('page');
    expect(workAreaModeOf('full-width', true, 'split', true)).toBe('page');
    expect(workAreaModeOf('full-width', true, 'full', true)).toBe('chat');
    expect(workAreaModeOf('home', true, 'split', true)).toBe('page');
  });

  it('phone: the page alone, whatever the chat', () => {
    expect(workAreaModeOf('page', true, 'split', false, true)).toBe('page');
    expect(workAreaModeOf('page', true, 'full', false, true)).toBe('page');
  });
});

describe('the composer host', () => {
  function Composer({ onMount }: { onMount: () => void }) {
    useEffect(onMount, [onMount]);
    return <textarea aria-label="Draft" />;
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
          <ManhattanComposerSlot active={!inColumn} />
        </section>
        <section aria-label="column">
          <ManhattanComposerSlot active={inColumn} />
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

  it('draws no page header on a chat page (the chat header is its header)', () => {
    nav.pathname = '/mingo/chat/';
    chatState.activeDialogId = 'd-1';
    renderCentre();
    expect(currentMode()).toBe('page');
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

  it('alone with a chat waiting: brings it back beside the page; close leaves that chat on its page', () => {
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
    expect(currentMode()).toBe('page');
  });

  it.each(['hidden', 'full'] as const)('a new page comes beside the chat, whatever the last one had (%s)', view => {
    chatState.activeDialogId = 'd-1';
    useManhattanCentreStore.setState({ chatView: view });
    renderCentre();
    expect(currentMode()).not.toBe('split');
    nav.pathname = '/devices/details/remote-shell/';
    renderCentre();
    expect(useManhattanCentreStore.getState().chatView).toBe('split');
    expect(currentMode()).toBe('split');
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

    it('keeps the thread for a first send on its way (no chat id yet)', () => {
      chatState.messages = [{ id: 'm-1' }];
      renderColumn();
      expect(startWork()?.classList.contains('hidden')).toBe(true);
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
