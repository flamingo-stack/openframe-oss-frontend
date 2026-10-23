/**
 * A mention chip opens its entity in this window, through the router; a modifier click is the browser's. Where this
 * window can open a tab (see `useSameWindowLinks`), a separate segment opens the page in one.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MentionTag } from './mention-tag';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

let sameWindow = true;
vi.mock('@/app/hooks/use-same-window-links', () => ({ useSameWindowLinks: () => sameWindow }));

// The lib `Tag` measures its label for the truncation tooltip; jsdom has no
// `ResizeObserver`, and nothing here depends on the measurement.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  push.mockReset();
  sameWindow = true;
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

function click(anchor: HTMLAnchorElement, init: MouseEventInit = {}) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  act(() => {
    anchor.dispatchEvent(event);
  });
  return event;
}

describe('MentionTag click', () => {
  it('opens the entity in this window', () => {
    const href = '/devices/details?id=m-1';
    const anchor = renderChip(href);
    expect(anchor.getAttribute('target')).toBeNull();

    const event = click(anchor);

    expect(event.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledWith(href);
  });

  it('lets a modifier click hand the href to the browser', () => {
    const event = click(renderChip('/devices/details?id=m-1'), { metaKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it('offers no new-tab segment where links stay in this window', () => {
    renderChip('/devices/details?id=m-1');

    expect(container.querySelector('a[target="_blank"]')).toBeNull();
  });

  it('opens the page in a new tab from its own segment where a tab is available', () => {
    sameWindow = false;
    const href = '/devices/details?id=m-1';
    const anchor = renderChip(href);
    const newTab = container.querySelector<HTMLAnchorElement>('a[target="_blank"]');

    expect(newTab?.getAttribute('href')).toBe(href);
    expect(newTab?.getAttribute('rel')).toBe('noopener noreferrer');

    click(anchor);
    expect(push).toHaveBeenCalledWith(href);
  });
});
