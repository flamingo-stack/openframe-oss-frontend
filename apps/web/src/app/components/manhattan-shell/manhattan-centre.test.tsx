/**
 * The Manhattan v2 centre: which work-area columns show (plan D5, table T), the page
 * column's header per mode (matrix H), and the composer moving between the dock and the
 * chat column without remounting (plan C1: the draft survives).
 */

import { act, type ReactNode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManhattanCentre } from './manhattan-centre';
import { useManhattanCentreStore, workAreaModeOf } from './manhattan-centre-store';
import { ManhattanComposerPortal, ManhattanComposerSlot } from './manhattan-composer-host';

const { nav, chatState } = vi.hoisted(() => ({
  nav: { pathname: '/devices', push: vi.fn() },
  chatState: { activeDialogId: null as string | null },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
  useSearchParams: () => new URLSearchParams(),
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
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  nav.pathname = '/devices';
  nav.push.mockReset();
  chatState.activeDialogId = null;
  useManhattanCentreStore.setState({ chatView: 'split' });
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
    ['page', false, 'split', 'page'],
    ['page', true, 'split', 'split'],
    ['page', true, 'full', 'chat'],
    ['page', true, 'hidden', 'page'],
    ['full-width', true, 'split', 'page'],
    ['full-width', true, 'full', 'chat'],
  ] as const)('%s, open chat %s, view %s → %s', (route, open, view, mode) => {
    expect(workAreaModeOf(route, open, view)).toBe(mode);
  });

  it('compact: the chat over the page instead of beside it, never over a full-height page unasked', () => {
    expect(workAreaModeOf('page', true, 'split', true)).toBe('chat');
    expect(workAreaModeOf('page', true, 'hidden', true)).toBe('page');
    expect(workAreaModeOf('full-width', true, 'split', true)).toBe('page');
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

  it('floats the dock over Start Work and plain pages, never beside a chat', () => {
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
    expect(floats?.(true)).toBe(true);
    chatState.activeDialogId = 'd-1';
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

  it('alone with a chat waiting: brings it back beside the page; close goes to Start Work', () => {
    chatState.activeDialogId = 'd-1';
    useManhattanCentreStore.setState({ chatView: 'hidden' });
    renderCentre();
    click('Close page');
    expect(nav.push).toHaveBeenCalledWith('/mingo');

    click('Show the chat beside the page');
    expect(currentMode()).toBe('split');
  });

  it('alone with no chat: no layout button', () => {
    renderCentre();
    expect(currentMode()).toBe('page');
    expect(button('Show the chat beside the page')).toBeNull();
    expect(button('Close page')).not.toBeNull();
  });
});
