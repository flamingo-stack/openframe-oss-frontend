/**
 * Pins how a same-window chip click leaves the launcher store, because that
 * state is read one effect later by `useMingoDialogUrlSync`, off the
 * PRE-navigation location. A close that does not carry `closedForNavigation`
 * makes the sync strip `?mingoDialog=` with a `replaceState` of the old URL —
 * over the push still in flight — and the tap lands nowhere. The new-tab chip
 * never touched the drawer, so the desktop web never saw it.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
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

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  push.mockReset();
  useMingoLauncherStore.setState({ isOpen: true, closedForNavigation: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderChip(href: string) {
  act(() => {
    root.render(<MentionTag label="app-server-03" href={href} />);
  });
  const anchor = container.querySelector('a');
  if (!anchor) throw new Error('chip rendered no anchor');
  return anchor;
}

function primaryClick(anchor: HTMLAnchorElement) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  act(() => {
    anchor.dispatchEvent(event);
  });
  return event;
}

describe('MentionTag click', () => {
  it('closes the drawer FOR the navigation it issues in the same window', () => {
    sameWindow = true;
    const href = '/devices/details?id=m-1';
    const event = primaryClick(renderChip(href));

    expect(event.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledWith(href);
    expect(useMingoLauncherStore.getState()).toMatchObject({ isOpen: false, closedForNavigation: true });
  });

  it('leaves the drawer and the router alone when the chip opens a new tab', () => {
    sameWindow = false;
    const anchor = renderChip('/devices/details?id=m-1');
    expect(anchor.getAttribute('target')).toBe('_blank');

    const event = primaryClick(anchor);

    expect(event.defaultPrevented).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(useMingoLauncherStore.getState()).toMatchObject({ isOpen: true, closedForNavigation: false });
  });

  it('lets a modifier click hand the href to the browser, drawer intact', () => {
    sameWindow = true;
    const anchor = renderChip('/devices/details?id=m-1');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true });
    act(() => {
      anchor.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(useMingoLauncherStore.getState().isOpen).toBe(true);
  });
});
