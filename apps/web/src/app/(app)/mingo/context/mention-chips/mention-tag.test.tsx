/**
 * Pins how a chip click behaves. The chip is a chat link like any other: a plain
 * click goes through the chat runtime's navigation (`NavLinkAnchorViaRuntime` →
 * `runtime.navigation.navigate`, which owns the drawer and `?mingoDialog=`), a
 * chip that opens something in the drawer (`onOpen`) claims the click itself, a
 * modifier click stays the browser's, and the new-tab segment is a plain `_blank`
 * link carrying the conversation, offered only where a tab is.
 */

import { type ChatRuntime, ChatRuntimeContext } from '@flamingo-stack/openframe-frontend-core/contexts';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoMessagesStore } from '@/app/(app)/mingo/stores/mingo-messages-store';
import { MentionTag } from './mention-tag';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/dashboard' }));

/** The chat runtime the chip navigates through (the app's own is `OpenframeChatRuntimeProvider`). */
const navigate = vi.fn(() => true);
const runtime = {
  endpoints: {},
  navigation: { mode: 'host', navigate, decideNewTab: () => false },
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
    root.render(
      <ChatRuntimeContext.Provider value={runtime}>
        <MentionTag label="app-server-03" href={href} onOpen={onOpen} />
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

  it('hands a primary click to onOpen instead of navigating, no new tab', () => {
    sameWindow = false;
    const onOpen = vi.fn();
    const anchor = renderChip('/dashboard?mingoDialog=d-1', onOpen);
    expect(newTabSegment()).toBeNull();

    const event = primaryClick(anchor);

    expect(event.defaultPrevented).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
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
  it('opens the page in a new tab with the conversation, leaving this window alone', () => {
    sameWindow = false;
    renderChip(HREF);
    const segment = newTabSegment();
    if (!segment) throw new Error('no new-tab segment');
    expect(segment.getAttribute('href')).toBe('/devices/details?id=m-1&mingoDialog=d-1');
    expect(segment.getAttribute('rel')).toBe('noopener noreferrer');
    expect(segment.getAttribute('aria-label')).toBe('Open in new tab');

    const event = primaryClick(segment);

    expect(event.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('is not offered where this window cannot or should not open a tab', () => {
    sameWindow = true;
    renderChip(HREF);
    expect(newTabSegment()).toBeNull();
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('is not offered on a chip with no page to open', () => {
    sameWindow = false;
    act(() => {
      root.render(<MentionTag label="alice@example.com" />);
    });
    expect(container.querySelector('a')).toBeNull();
  });
});
