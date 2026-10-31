/**
 * Pins how a chip click behaves. The chip is a chat link like any other: a plain
 * click goes through the chat runtime's navigation (`NavLinkAnchorViaRuntime` →
 * `runtime.navigation.navigate`), a modifier click stays the browser's, and the
 * new-tab segment is a plain `_blank` link to the page alone (a `?mingoDialog=`
 * would send that tab to the chat page), offered only where a tab is. Also that
 * the chip fits what holds it, a table cell on a phone.
 */

import { type ChatRuntime, ChatRuntimeContext } from '@flamingo-stack/openframe-frontend-core/contexts';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MentionTag } from './mention-tag';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/dashboard' }));

/** The chat runtime the chip navigates through (the app's own is `OpenframeChatRuntimeProvider`). */
const navigate = vi.fn(() => true);
const openExternal = vi.fn();
const runtime = {
  endpoints: {},
  navigation: { mode: 'host', navigate, openExternal, decideNewTab: () => false },
  source: 'openframe',
} as unknown as ChatRuntime;

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

const HREF = '/devices/details?id=m-1';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  push.mockReset();
  navigate.mockClear();
  openExternal.mockClear();
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
    root.render(
      <ChatRuntimeContext.Provider value={runtime}>
        <MentionTag label="app-server-03" href={href} />
      </ChatRuntimeContext.Provider>,
    );
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
  it('follows the chat runtime navigation, like every chat link', () => {
    sameWindow = false;
    const anchor = renderChip(HREF);
    expect(anchor.getAttribute('target')).toBeNull();

    const event = primaryClick(anchor);

    expect(event.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ href: HREF }));
    expect(push).not.toHaveBeenCalled();
  });

  it('lets a modifier click hand the href to the browser', () => {
    sameWindow = true;
    const anchor = renderChip(HREF);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true });
    act(() => {
      anchor.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('MentionTag new-tab segment', () => {
  it('opens the page alone in a new tab, leaving this window alone', () => {
    sameWindow = false;
    renderChip(HREF);
    const segment = newTabSegment();
    if (!segment) throw new Error('no new-tab segment');
    expect(segment.getAttribute('href')).toBe(HREF);
    expect(segment.getAttribute('target')).toBe('_blank');
    // A path of this site keeps the Referer (the lib's one referrer rule).
    expect(segment.getAttribute('rel')).toBe('noopener');
    expect(segment.getAttribute('aria-label')).toBe('Open in new tab');

    primaryClick(segment);

    // The lib's executor opens the tab through the runtime's `openExternal`; this window does not move.
    expect(openExternal).toHaveBeenCalledWith(HREF);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('is not offered where this window cannot or should not open a tab', () => {
    sameWindow = true;
    renderChip(HREF);
    expect(newTabSegment()).toBeNull();
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('fits what holds it: the PAIR is capped, the main segment giving up its width first and the chip filling it', () => {
    sameWindow = false;
    renderChip(HREF);
    const pair = container.firstElementChild;
    // Capped on the chip instead, the link kept the whole label's width and a long name left a gap before the
    // new-tab segment.
    expect(pair?.className).toContain('max-w-[min(16rem,100%)]');
    expect(pair?.querySelector('a')?.className).toContain('min-w-0');
    expect(container.querySelector('[data-testid="inline-chip"]')?.className).toContain('max-w-full');
  });

  it('is not offered on a chip with no page to open', () => {
    sameWindow = false;
    act(() => {
      root.render(<MentionTag label="alice@example.com" />);
    });
    expect(container.querySelector('a')).toBeNull();
  });
});
