/**
 * A host chip (the lib's `RecordChip` with this app's own route) opens the record the way every chat link does: a plain
 * click through the chat runtime's navigation, a modifier click left to the browser, and a new-tab link to the page
 * alone where this window opens tabs (`navigation.opensTabs`). The vulnerability chip is the one with no fetch.
 */

import { type ChatRuntime, ChatRuntimeContext } from '@flamingo-stack/openframe-frontend-core/contexts';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { renderMingoRecordChip } from './render-mention';

vi.mock('react-relay', () => ({ graphql: () => ({}), useLazyLoadQuery: vi.fn() }));
vi.mock('./relay-mention-chips', () => ({ GraphqlMentionChip: vi.fn() }));
vi.mock('./rest-mention-chips', () => ({ RestMentionChip: vi.fn() }));
vi.mock('../context-sources', () => ({ MINGO_CONTEXT_ENTITY_TYPES: [] }));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/dashboard' }));

// The lib `Tag` measures its label for the truncation tooltip; jsdom has no `ResizeObserver`.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const CVE = 'CVE-2024-1234';
const HREF = routes.software.vulnerability(CVE);
const navigate = vi.fn(() => true);
const openExternal = vi.fn();

function runtimeFor(opensTabs: boolean): ChatRuntime {
  return {
    endpoints: {},
    navigation: { mode: 'host', navigate, openExternal, decideNewTab: () => false, opensTabs },
    source: 'openframe',
  } as unknown as ChatRuntime;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

function renderChip(opensTabs: boolean) {
  act(() => {
    root.render(
      <ChatRuntimeContext.Provider value={runtimeFor(opensTabs)}>
        {renderMingoRecordChip({ type: 'vulnerability', id: CVE })}
      </ChatRuntimeContext.Provider>,
    );
  });
}

const nameLink = () => container.querySelector<HTMLAnchorElement>('a:not([target="_blank"])');
const newTabLink = () => container.querySelector<HTMLAnchorElement>('a[target="_blank"]');

function click(anchor: HTMLAnchorElement, init: MouseEventInit = {}) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  act(() => {
    anchor.dispatchEvent(event);
  });
  return event;
}

describe('a host record chip', () => {
  it('follows the chat runtime navigation, like every chat link', () => {
    renderChip(true);
    const anchor = nameLink();
    if (!anchor) throw new Error('chip rendered no link');
    // The chip's link names the whole record (its last word may sit in a second anchor, beside the action).
    expect(anchor.getAttribute('aria-label')).toBe(CVE);
    const event = click(anchor);
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ href: HREF }));
  });

  it('lets a modifier click hand the href to the browser', () => {
    renderChip(true);
    const anchor = nameLink();
    if (!anchor) throw new Error('chip rendered no link');
    const event = click(anchor, { metaKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('offers the page alone in a new tab where this window opens tabs, and nowhere else', () => {
    renderChip(true);
    expect(newTabLink()?.getAttribute('href')).toBe(HREF);
    act(() => root.unmount());
    root = createRoot(container);
    renderChip(false);
    expect(newTabLink()).toBeNull();
  });
});
