/**
 * Pins the overlay toolbar's auto-hide: visible on mount, gone after the idle
 * delay, back when the pointer rests in the top-edge hot zone, and held up by
 * whatever is interacting with it (a menu, the pointer, a focus, an unread).
 */
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AutoHideToolbar,
  TOOLBAR_HIDE_DELAY_MS,
  TOOLBAR_HOT_ZONE_PX,
  TOOLBAR_REVEAL_DWELL_MS,
  useAutoHideToolbar,
} from './use-auto-hide-toolbar';

let container: HTMLDivElement;
let root: Root;
let latest: AutoHideToolbar;

function Harness({ enabled, pinned }: { enabled: boolean; pinned?: boolean }) {
  const toolbar = useAutoHideToolbar(enabled, pinned);
  // Published from an effect, not during render (a render must not write a module variable).
  useEffect(() => {
    latest = toolbar;
  });
  return (
    <div data-testid="stream" onPointerMove={toolbar.onPointerMove} onPointerLeave={toolbar.onPointerLeave}>
      {toolbar.visible ? 'visible' : 'hidden'}
    </div>
  );
}

const render = (enabled: boolean, pinned?: boolean) =>
  act(() => root.render(<Harness enabled={enabled} pinned={pinned} />));
const visible = () => latest.visible;
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/** A pointermove on the stream at `y` px below its top edge (the stream sits at y=0 in jsdom). */
function moveTo(y: number) {
  const stream = container.querySelector('[data-testid="stream"]') as HTMLElement;
  stream.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 }) as DOMRect;
  act(() => {
    stream.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: y, bubbles: true }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('useAutoHideToolbar', () => {
  it('is always visible while disabled', () => {
    render(false);
    expect(visible()).toBe(true);
    advance(TOOLBAR_HIDE_DELAY_MS * 2);
    expect(visible()).toBe(true);
  });

  it('shows on mount and hides after the idle delay', () => {
    render(true);
    expect(visible()).toBe(true);
    advance(TOOLBAR_HIDE_DELAY_MS - 1);
    expect(visible()).toBe(true);
    advance(1);
    expect(visible()).toBe(false);
  });

  it('comes back when the pointer rests in the top-edge hot zone', () => {
    render(true);
    advance(TOOLBAR_HIDE_DELAY_MS);
    expect(visible()).toBe(false);

    moveTo(TOOLBAR_HOT_ZONE_PX);
    expect(visible()).toBe(false); // not before the dwell
    advance(TOOLBAR_REVEAL_DWELL_MS);
    expect(visible()).toBe(true);

    advance(TOOLBAR_HIDE_DELAY_MS);
    expect(visible()).toBe(false);
  });

  it('does not reveal for a pointer that only passes through the hot zone', () => {
    render(true);
    advance(TOOLBAR_HIDE_DELAY_MS);

    moveTo(TOOLBAR_HOT_ZONE_PX - 2);
    advance(TOOLBAR_REVEAL_DWELL_MS / 2);
    moveTo(TOOLBAR_HOT_ZONE_PX + 40); // left the zone before the dwell elapsed
    advance(TOOLBAR_REVEAL_DWELL_MS);
    expect(visible()).toBe(false);

    moveTo(TOOLBAR_HOT_ZONE_PX - 2);
    advance(TOOLBAR_REVEAL_DWELL_MS / 2);
    act(() => latest.onPointerLeave());
    advance(TOOLBAR_REVEAL_DWELL_MS);
    expect(visible()).toBe(false);
  });

  it('stays up while held and starts the countdown once the last hold is released', () => {
    render(true);
    act(() => latest.hold('actions-menu', true));
    act(() => latest.hold('hover', true));
    advance(TOOLBAR_HIDE_DELAY_MS * 2);
    expect(visible()).toBe(true);

    act(() => latest.hold('hover', false));
    advance(TOOLBAR_HIDE_DELAY_MS * 2);
    expect(visible()).toBe(true); // the menu still holds it

    act(() => latest.hold('actions-menu', false));
    advance(TOOLBAR_HIDE_DELAY_MS - 1);
    expect(visible()).toBe(true);
    advance(1);
    expect(visible()).toBe(false);
  });

  it('a hold brings a hidden toolbar back (keyboard focus, a new chat message)', () => {
    render(true);
    advance(TOOLBAR_HIDE_DELAY_MS);
    expect(visible()).toBe(false);

    act(() => latest.hold('focus', true));
    expect(visible()).toBe(true);
    act(() => latest.hold('focus', false));
    advance(TOOLBAR_HIDE_DELAY_MS);
    expect(visible()).toBe(false);
  });

  it('shows once more when the preference is turned on, then hides again', () => {
    render(true);
    advance(TOOLBAR_HIDE_DELAY_MS);
    expect(visible()).toBe(false);

    render(false);
    expect(visible()).toBe(true);

    render(true);
    expect(visible()).toBe(true);
    advance(TOOLBAR_HIDE_DELAY_MS);
    expect(visible()).toBe(false);
  });

  it('reveal() shows the toolbar and restarts the countdown', () => {
    render(true);
    advance(TOOLBAR_HIDE_DELAY_MS);
    act(() => latest.reveal());
    expect(visible()).toBe(true);
    advance(TOOLBAR_HIDE_DELAY_MS - 1);
    expect(visible()).toBe(true);
    advance(1);
    expect(visible()).toBe(false);
  });

  it('pinned: stays up while pinned and counts down from visible once unpinned', () => {
    render(true);
    advance(TOOLBAR_HIDE_DELAY_MS);
    expect(visible()).toBe(false);

    render(true, true); // the settings modal opened / a chat message arrived
    expect(visible()).toBe(true);
    advance(TOOLBAR_HIDE_DELAY_MS * 2);
    expect(visible()).toBe(true);
    act(() => latest.hold('hover', true));
    act(() => latest.hold('hover', false));
    advance(TOOLBAR_HIDE_DELAY_MS * 2);
    expect(visible()).toBe(true); // a released hold does not override the pin

    render(true, false);
    expect(visible()).toBe(true);
    advance(TOOLBAR_HIDE_DELAY_MS - 1);
    expect(visible()).toBe(true);
    advance(1);
    expect(visible()).toBe(false);
  });
});
