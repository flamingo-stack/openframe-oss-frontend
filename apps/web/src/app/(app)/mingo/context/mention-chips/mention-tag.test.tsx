/**
 * Pins where a chip click takes the user and what it leaves in the launcher
 * store, because that state is read one effect later by `useMingoDialogUrlSync`,
 * off the PRE-navigation location.
 *
 *   - Where the chat covers the page (a phone), the drawer closes FOR the push.
 *     A close that does not carry `closedForNavigation` makes the sync strip
 *     `?mingoDialog=` with a `replaceState` of the old URL — over the push still
 *     in flight — and the tap lands nowhere.
 *   - Everywhere else the conversation stays: the push carries it in
 *     `?mingoDialog=`, and a docked panel over the whole content area steps
 *     back to its column first, so the page it opened is on screen.
 *   - The new-tab segment is a plain `_blank` link carrying the conversation,
 *     offered only where a tab is (see `useSameWindowLinks`).
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { useMingoMessagesStore } from '@/app/(app)/mingo/stores/mingo-messages-store';
import { MentionTag } from './mention-tag';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// The lib `Tag` measures its label for the truncation tooltip; jsdom has no
// `ResizeObserver`, and nothing here depends on the measurement.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

let sameWindow = true;
vi.mock('@/app/hooks/use-same-window-links', () => ({ useSameWindowLinks: () => sameWindow }));

let mobileViewport = true;
vi.mock('@/app/hooks/use-is-mobile-viewport', () => ({ useIsMobileViewport: () => mobileViewport }));

const HREF = '/devices/details?id=m-1';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  push.mockReset();
  useMingoLauncherStore.setState({ isOpen: true, closedForNavigation: false, panelDocked: false, revealPage: null });
  useMingoMessagesStore.setState({ activeDialogId: 'd-1' });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderChip(href: string, onOpen?: () => void) {
  act(() => {
    root.render(<MentionTag label="app-server-03" href={href} onOpen={onOpen} />);
  });
  const anchor = container.querySelector('a');
  if (!anchor) throw new Error('chip rendered no anchor');
  return anchor;
}

function newTabSegment(): HTMLAnchorElement | null {
  return container.querySelector('a[target="_blank"]');
}

function primaryClick(anchor: HTMLAnchorElement) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  act(() => {
    anchor.dispatchEvent(event);
  });
  return event;
}

describe('MentionTag click', () => {
  it('closes the drawer FOR the navigation where the chat covers the page', () => {
    sameWindow = true;
    mobileViewport = true;
    const event = primaryClick(renderChip(HREF));

    expect(event.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledWith(HREF);
    expect(useMingoLauncherStore.getState()).toMatchObject({ isOpen: false, closedForNavigation: true });
  });

  it('opens the page beside a docked panel in place, conversation along, panel intact', () => {
    sameWindow = false;
    mobileViewport = false;
    useMingoLauncherStore.setState({ isOpen: false, panelDocked: true });
    const anchor = renderChip(HREF);
    expect(anchor.getAttribute('target')).toBeNull();

    const event = primaryClick(anchor);

    expect(event.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledWith('/devices/details?id=m-1&mingoDialog=d-1');
    expect(useMingoLauncherStore.getState()).toMatchObject({ panelDocked: true, closedForNavigation: false });
  });

  it('steps a panel over the whole content area back to its column before opening the page', () => {
    sameWindow = false;
    mobileViewport = false;
    const order: string[] = [];
    const revealPage = vi.fn(() => order.push('reveal'));
    push.mockImplementation(() => order.push('push'));
    useMingoLauncherStore.setState({ isOpen: false, panelDocked: true, revealPage });

    primaryClick(renderChip(HREF));

    expect(revealPage).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['reveal', 'push']);
  });

  it('keeps a drawer beside the page on a wide window open across the navigation', () => {
    sameWindow = false;
    mobileViewport = false;
    const event = primaryClick(renderChip(HREF));

    expect(event.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledWith('/devices/details?id=m-1&mingoDialog=d-1');
    expect(useMingoLauncherStore.getState()).toMatchObject({ isOpen: true, closedForNavigation: false });
  });

  it('opens a plain page when the chip sits in no conversation yet', () => {
    sameWindow = false;
    mobileViewport = false;
    useMingoMessagesStore.setState({ activeDialogId: null });
    primaryClick(renderChip(HREF));

    expect(push).toHaveBeenCalledWith(HREF);
    expect(newTabSegment()?.getAttribute('href')).toBe(HREF);
  });

  it('hands a primary click to onOpen instead of navigating, drawer intact, no new tab', () => {
    // Desktop web, where a plain chip offers a tab: an in-place target must not.
    sameWindow = false;
    mobileViewport = false;
    const onOpen = vi.fn();
    const anchor = renderChip('/dashboard?mingoDialog=d-1', onOpen);
    expect(anchor.getAttribute('target')).toBeNull();
    expect(newTabSegment()).toBeNull();

    const event = primaryClick(anchor);

    expect(event.defaultPrevented).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(useMingoLauncherStore.getState()).toMatchObject({ isOpen: true, closedForNavigation: false });
  });

  it('lets a modifier click hand the href to the browser, drawer intact', () => {
    sameWindow = true;
    mobileViewport = true;
    const anchor = renderChip(HREF);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true });
    act(() => {
      anchor.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(useMingoLauncherStore.getState().isOpen).toBe(true);
  });
});

describe('MentionTag new-tab segment', () => {
  it('opens the page in a new tab with the conversation, leaving this window alone', () => {
    sameWindow = false;
    mobileViewport = false;
    renderChip(HREF);
    const segment = newTabSegment();
    if (!segment) throw new Error('no new-tab segment');
    expect(segment.getAttribute('href')).toBe('/devices/details?id=m-1&mingoDialog=d-1');
    expect(segment.getAttribute('rel')).toBe('noopener noreferrer');
    expect(segment.getAttribute('aria-label')).toBe('Open in new tab');

    const event = primaryClick(segment);

    expect(event.defaultPrevented).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(useMingoLauncherStore.getState()).toMatchObject({ isOpen: true, closedForNavigation: false });
  });

  it('is not offered where this window cannot or should not open a tab', () => {
    sameWindow = true;
    mobileViewport = true;
    renderChip(HREF);
    expect(newTabSegment()).toBeNull();
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('is not offered in the app shells on a wide window, where the chip still opens the page in place', () => {
    // The desktop app (and a tablet running the mobile one): a wide window
    // with no tabs to open, so the shell alone decides.
    sameWindow = true;
    mobileViewport = false;
    const anchor = renderChip(HREF);
    expect(newTabSegment()).toBeNull();
    expect(container.querySelectorAll('a')).toHaveLength(1);

    primaryClick(anchor);

    expect(push).toHaveBeenCalledWith('/devices/details?id=m-1&mingoDialog=d-1');
    expect(useMingoLauncherStore.getState()).toMatchObject({ isOpen: true, closedForNavigation: false });
  });

  it('is not offered on a chip with no page to open', () => {
    sameWindow = false;
    mobileViewport = false;
    act(() => {
      root.render(<MentionTag label="alice@example.com" />);
    });
    expect(container.querySelector('a')).toBeNull();
  });
});
