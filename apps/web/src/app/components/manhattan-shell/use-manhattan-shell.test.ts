/**
 * The v2 right navigation starts collapsed on every load, whatever an earlier session left
 * in storage, and the user can still expand it.
 */

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { useManhattanNavCollapsed } from './use-manhattan-shell';

describe('useManhattanNavCollapsed', () => {
  it('starts collapsed, ignores the old stored preference, and expands on demand', () => {
    window.localStorage.setItem('of.manhattan.navigation.minimized', 'false');
    let collapsed: boolean | null = null;
    let setCollapsed: (next: boolean) => void = () => {};
    function Probe() {
      [collapsed, setCollapsed] = useManhattanNavCollapsed();
      return null;
    }
    const root = createRoot(document.createElement('div'));
    act(() => root.render(createElement(Probe)));
    expect(collapsed).toBe(true);

    act(() => setCollapsed(false));
    expect(collapsed).toBe(false);
    expect(window.localStorage.getItem('of.manhattan.navigation.minimized')).toBe('false');
    act(() => root.unmount());
  });
});
