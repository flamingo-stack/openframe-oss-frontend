// The app scrolls `<main>`, not the window: an observer rooted on the viewport has
// its `rootMargin` clipped away, and the live tail pauses the moment the 1px
// sentinel leaves `<main>` instead of 120px later.
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsAtTop } from './use-is-at-top';

interface Observed {
  options: IntersectionObserverInit | undefined;
  callback: IntersectionObserverCallback;
  disconnected: boolean;
}

let observers: Observed[];
let latest: boolean | null;
let host: HTMLElement;
let root: Root;

class FakeObserver {
  private readonly record: Observed;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.record = { options, callback, disconnected: false };
    observers.push(this.record);
  }

  observe() {}

  disconnect() {
    this.record.disconnected = true;
  }
}

function Probe() {
  const { ref, atTop } = useIsAtTop<HTMLDivElement>();
  useEffect(() => {
    latest = atTop;
  });
  return <div ref={ref} />;
}

function report(isIntersecting: boolean) {
  const observer = observers[observers.length - 1];
  act(() => observer.callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));
}

beforeEach(() => {
  observers = [];
  latest = null;
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function mountIn(parent: HTMLElement) {
  host = parent;
  document.body.appendChild(host);
  const container = document.createElement('div');
  host.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Probe />));
}

describe('useIsAtTop', () => {
  it("observes against the app's <main> scroller, where the margin is not clipped", () => {
    const main = document.createElement('main');
    mountIn(main);
    expect(observers[0].options).toMatchObject({ root: main, rootMargin: '120px' });
  });

  it('falls back to the viewport outside the app shell', () => {
    mountIn(document.createElement('div'));
    expect(observers[0].options?.root).toBeNull();
  });

  it('follows the sentinel in both directions, not just the first time', () => {
    mountIn(document.createElement('main'));
    report(false);
    expect(latest).toBe(false);
    report(true);
    expect(latest).toBe(true);
  });

  it('disconnects when the list goes away', () => {
    mountIn(document.createElement('main'));
    act(() => root.unmount());
    expect(observers[0].disconnected).toBe(true);
    root = createRoot(document.createElement('div'));
  });
});
