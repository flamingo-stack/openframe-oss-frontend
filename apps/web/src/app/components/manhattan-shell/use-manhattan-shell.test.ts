/**
 * The v2 right navigation: by default open from 1280px and the rail narrower; the user's choice, once made, is kept
 * across loads at every width, under a key of its own (an old build's stored value decides nothing).
 */

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useManhattanNavCollapsed } from './use-manhattan-shell';

const KEY = 'of.manhattan.navigation.collapsed';
const JSDOM_WIDTH = window.innerWidth;

/** The window's width as the default reads it (jsdom has no matchMedia, so the store reads innerWidth). */
function windowWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
}

function mountProbe() {
  const state: { collapsed: boolean | null; setCollapsed: (next: boolean) => void } = {
    collapsed: null,
    setCollapsed: () => {},
  };
  function Probe() {
    [state.collapsed, state.setCollapsed] = useManhattanNavCollapsed();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Probe)));
  return { state, unmount: () => act(() => root.unmount()) };
}

describe('useManhattanNavCollapsed', () => {
  afterEach(() => {
    window.localStorage.clear();
    windowWidth(JSDOM_WIDTH);
  });

  it.each([
    [1440, false],
    [1280, false],
    [1279, true],
    [1000, true],
  ])('on a first visit at %ipx, collapsed is %s', (width, expected) => {
    windowWidth(width);
    const probe = mountProbe();
    expect(probe.state.collapsed).toBe(expected);
    probe.unmount();
  });

  it("the old build's stored key decides nothing", () => {
    window.localStorage.setItem('of.manhattan.navigation.minimized', 'true');
    windowWidth(1440);
    const probe = mountProbe();
    expect(probe.state.collapsed).toBe(false);
    probe.unmount();
  });

  it("keeps the user's choice for the next load, at every width", () => {
    windowWidth(1440);
    const first = mountProbe();
    act(() => first.state.setCollapsed(true));
    expect(first.state.collapsed).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe('true');
    first.unmount();

    const next = mountProbe();
    expect(next.state.collapsed).toBe(true);
    next.unmount();

    windowWidth(1000);
    const narrow = mountProbe();
    act(() => narrow.state.setCollapsed(false));
    expect(narrow.state.collapsed).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe('false');
    narrow.unmount();
  });

  it('moves every reader on the page at once (the navigation and the phone menu)', () => {
    windowWidth(1440);
    const a = mountProbe();
    const b = mountProbe();
    act(() => a.state.setCollapsed(true));
    expect(b.state.collapsed).toBe(true);
    a.unmount();
    b.unmount();
  });
});
