import { act, type ReactNode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoContextStore } from '@/app/(app)/mingo/stores/mingo-context-store';
import type { ComposerRoute } from './mingo-dock-route';
import { useMingoSheetStore } from './mingo-sheet-store';
import { PAGE_OVERVIEW_PROMPT, usePageChip } from './use-page-chip';

// The picker's kinds, as far as the chip reads them; INSIGHT stands for a kind whose module is off.
vi.mock('@/app/(app)/mingo/context/context-sources', () => ({
  MINGO_CONTEXT_ENTITY_TYPES: [
    { type: 'ORGANIZATION', label: 'Customer' },
    { type: 'DEVICE', label: 'Device' },
  ],
  useMingoContextEntityTypes: () => [
    { type: 'ORGANIZATION', label: 'Customer', icon: null },
    { type: 'DEVICE', label: 'Device', icon: null },
  ],
}));
const location = { pathname: '/devices/', search: '' };
vi.mock('next/navigation', () => ({
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}));

const onAsk = vi.fn();
const probe = { node: null as ReactNode };
function Harness({ route }: { route: ComposerRoute }) {
  const node = usePageChip(route, onAsk);
  useEffect(() => {
    probe.node = node;
  });
  return <>{node}</>;
}

let container: HTMLDivElement;
let root: Root;
const render = (route: ComposerRoute, pathname = '/devices/', search = '') => {
  location.pathname = pathname;
  location.search = search;
  act(() => root.render(<Harness route={route} />));
};
const buttons = () => [...container.querySelectorAll('button')];
const named = (name: string) => buttons().find(button => button.getAttribute('aria-label') === name) ?? null;
const click = (button: HTMLButtonElement | null) => act(() => button?.click());

describe('usePageChip', () => {
  beforeEach(() => {
    onAsk.mockReset();
    useMingoContextStore.setState({ openView: null, recentViews: [] });
    useMingoSheetStore.setState({ lastPage: null, outsidePage: null, newChatPage: null });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('names the page as Mingo is told it, on a list, in the settings and on its own pages', () => {
    for (const [pathname, search, title] of [
      ['/devices/', 'statuses=OFFLINE', 'Devices'],
      ['/settings/', 'tab=api-keys', 'Settings'],
      ['/approvals/', '', 'Needs approval'],
      ['/mingo/archive/', '', 'Chat Archive'],
      ['/dashboard/', '', 'Dashboard'],
    ]) {
      render('page', pathname, search);
      expect(container.textContent).toBe(title);
      expect(named(`Ask Mingo about this page: ${title}`)).not.toBeNull();
    }
  });

  it('is drawn as the "Continue …" chip is: an outline compact button', () => {
    render('page');
    const chip = named('Ask Mingo about this page: Devices');
    // The same variant and size as the dock's "Continue …" chip, so the two match.
    expect(chip?.className).toContain('h-6');
  });

  it('asks Mingo for an overview of the page on a click', () => {
    render('page');
    click(named('Ask Mingo about this page: Devices'));
    expect(onAsk).toHaveBeenCalledWith(PAGE_OVERVIEW_PROMPT);
  });

  it("gives the page's own chip no ×: the page is always sent", () => {
    render('page');
    expect(buttons()).toHaveLength(1);
  });

  it("shows nothing on a desktop's new chat: no page to ask about, wherever the tab was", () => {
    useMingoContextStore.setState({ openView: { type: 'DEVICE', id: 'd-1', label: 'MacBook' } });
    useMingoSheetStore.setState({ lastPage: '/devices/', outsidePage: '/devices/', newChatPage: '/devices/' });
    render('home', '/mingo/');
    expect(probe.node).toBeNull();
  });

  it("names the page's entity, kind first, on its page, and asks about it", () => {
    useMingoContextStore.setState({ openView: { type: 'ORGANIZATION', id: 'o-1', label: 'Default' } });
    for (const route of ['page', 'full-width'] as const) {
      render(route, '/customers/details/', 'id=o-1');
      expect(container.textContent).toBe('Customer: Default');
    }
    click(named('Ask Mingo about this page: Customer: Default'));
    expect(onAsk).toHaveBeenCalledWith(PAGE_OVERVIEW_PROMPT);
  });

  it('names the page by its kind for an entity whose module is off, or before it lands', () => {
    useMingoContextStore.setState({ openView: { type: 'INSIGHT', id: 'i-1', label: 'Disk low' } });
    render('page', '/customers/details/', 'id=o-1');
    expect(container.textContent).toBe('Customer');
  });

  it("takes the entity out of Mingo's context with its ×", () => {
    useMingoContextStore.setState({ openView: { type: 'DEVICE', id: 'd-1', label: 'MacBook' } });
    render('page', '/devices/details/', 'id=d-1');
    click(named('Remove Device: MacBook'));
    expect(useMingoContextStore.getState().openView).toBeNull();
    expect(onAsk).not.toHaveBeenCalled();
    expect(container.textContent).toBe('Device');
  });

  it('names on the chat page the page it was opened from, which its messages are about', () => {
    useMingoSheetStore.setState({ lastPage: '/devices/?statuses=OFFLINE' });
    render('chat', '/mingo/chat/', 'id=d-1');
    expect(container.textContent).toBe('Devices');
    click(named('Ask Mingo about this page: Devices'));
    expect(onAsk).toHaveBeenCalledWith(PAGE_OVERVIEW_PROMPT);
  });

  it('shows nothing on a chat page opened from no page, or from the home', () => {
    render('chat', '/mingo/chat/', 'id=d-1');
    expect(probe.node).toBeNull();
    useMingoSheetStore.setState({ lastPage: '/mingo/' });
    render('chat', '/mingo/chat/', 'id=d-1');
    expect(probe.node).toBeNull();
  });

  describe('on a phone', () => {
    const matchMedia = window.matchMedia;
    beforeEach(() => {
      // Narrower than md: no query matches.
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })) as unknown as typeof window.matchMedia;
    });
    afterEach(() => {
      window.matchMedia = matchMedia;
    });

    it('names on the home, and on a chat started there, the page a new chat was started over', () => {
      useMingoSheetStore.setState({ lastPage: '/mingo/', outsidePage: '/devices/', newChatPage: '/devices/' });
      render('home', '/mingo/');
      expect(container.textContent).toBe('Devices');
      render('chat', '/mingo/chat/', 'id=d-1');
      expect(container.textContent).toBe('Devices');
    });

    it('shows nothing on the home when the list was opened over no page', () => {
      render('home', '/mingo/');
      expect(probe.node).toBeNull();
    });

    it('shows no chip of the previous page on a home reached another way, nor on a chat started there', () => {
      useMingoSheetStore.setState({ lastPage: '/settings/', outsidePage: '/settings/' });
      render('home', '/mingo/');
      expect(probe.node).toBeNull();
      useMingoSheetStore.setState({ lastPage: '/mingo/' });
      render('chat', '/mingo/chat/', 'id=d-1');
      expect(probe.node).toBeNull();
    });
  });
});
