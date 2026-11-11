/**
 * The v2 shell's window form: only the tablet band is compact; a narrower desktop window
 * folds no sidebar.
 */

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { squeezeOf, useManhattanSqueeze } from './use-manhattan-squeeze';

describe('squeezeOf', () => {
  it('is compact from md up to two rails + 800px, and leaves the phone to its own shell', () => {
    expect(squeezeOf({ windowWidth: 860 }).compact).toBe(true);
    expect(squeezeOf({ windowWidth: 800 }).compact).toBe(true);
    expect(squeezeOf({ windowWidth: 912 }).compact).toBe(false);
    expect(squeezeOf({ windowWidth: 700 }).compact).toBe(false);
  });

  it('folds nothing on a narrow desktop: the sidebars stay as the user left them', () => {
    for (const windowWidth of [1000, 1100, 1280, 1440]) expect(squeezeOf({ windowWidth })).toEqual({ compact: false });
  });
});

describe('useManhattanSqueeze', () => {
  it('re-renders on a resize only when the window crosses a step, not on every pixel', () => {
    const resize = (width: number) =>
      act(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
        window.dispatchEvent(new Event('resize'));
      });
    resize(1000);
    let renders = 0;
    let compact: boolean | null = null;
    function Probe() {
      renders += 1;
      compact = useManhattanSqueeze(true).compact;
      return null;
    }
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(createElement(Probe)));
    const settled = renders;
    expect(compact).toBe(false);

    resize(1100);
    resize(1280);
    expect(renders).toBe(settled);

    resize(860);
    expect(compact).toBe(true);
    expect(renders).toBe(settled + 1);
    act(() => root.unmount());
  });
});
