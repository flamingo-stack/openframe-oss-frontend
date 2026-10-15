/**
 * The Mingo-first shell controls the sidebar's collapse (so ⌘K can reveal it) and has to
 * persist it itself, under the core sidebar's own key: the pre-paint width seed reads it,
 * and so does the classic shell's sidebar, which also hears the write in-page.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sidebarWidthFoucScript } from '@/lib/navigation-sidebar-state';
import { useSidebarCollapsed } from './use-sidebar-collapsed';

const KEY = 'of.navigationSidebar.minimized';

let container: HTMLDivElement;
let root: Root;
/** The setter each render handed out, collected after the commit. */
const setters: Array<(collapsed: boolean) => void> = [];
const setCollapsed = (collapsed: boolean) => setters[setters.length - 1](collapsed);

function Probe() {
  const [collapsed, set] = useSidebarCollapsed();
  useEffect(() => {
    setters.push(set);
  });
  return <span>{collapsed ? 'collapsed' : 'expanded'}</span>;
}

beforeEach(() => {
  setters.length = 0;
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
});

describe('useSidebarCollapsed', () => {
  it('starts from the persisted preference', () => {
    window.localStorage.setItem(KEY, 'true');
    act(() => root.render(<Probe />));
    expect(container.textContent).toBe('collapsed');
  });

  it('persists in the core sidebar encoding and re-renders its readers', () => {
    act(() => root.render(<Probe />));
    expect(container.textContent).toBe('expanded');

    act(() => setCollapsed(true));
    expect(container.textContent).toBe('collapsed');
    expect(window.localStorage.getItem(KEY)).toBe('true');

    act(() => setCollapsed(false));
    expect(container.textContent).toBe('expanded');
    expect(window.localStorage.getItem(KEY)).toBe('false');
  });

  it('tells the core sidebar’s own copy, through its in-page update event', () => {
    const seen: unknown[] = [];
    const listener = (event: Event) => seen.push((event as CustomEvent).detail);
    window.addEventListener('localStorageUpdate', listener);
    act(() => root.render(<Probe />));
    act(() => setCollapsed(true));
    window.removeEventListener('localStorageUpdate', listener);
    expect(seen).toEqual([{ key: KEY, newValue: 'true' }]);
  });

  it('follows a change made in another tab', () => {
    act(() => root.render(<Probe />));
    act(() => {
      window.localStorage.setItem(KEY, 'true');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: 'true' }));
    });
    expect(container.textContent).toBe('collapsed');
  });

  it('writes the key the pre-paint width seed reads', () => {
    expect(sidebarWidthFoucScript).toContain(`'${KEY}'`);
  });
});
