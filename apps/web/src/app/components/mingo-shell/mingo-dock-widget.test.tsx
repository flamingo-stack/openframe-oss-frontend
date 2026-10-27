/**
 * The composer folded into a button over a page's action bar: a tap opens it, a drag
 * moves it and settles it on the nearer side, above the bar and inside the window, where
 * it stays for the next page.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maxLift, MingoDockWidget, settle } from './mingo-dock-widget';

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({ MingoEdgeLight: () => null }));
vi.mock('@flamingo-stack/openframe-frontend-core/components/icons-v2', () => ({ MingoIcon: () => null }));
vi.mock('@flamingo-stack/openframe-frontend-core/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

const WINDOW = { width: 768, height: 1024 };
const BAR = 96;

let container: HTMLDivElement;
let root: Root;
const onOpen = vi.fn();

function render() {
  act(() => root.render(<MingoDockWidget barHeight={BAR} onOpen={onOpen} />));
}

const button = () => {
  const found = document.querySelector<HTMLButtonElement>('button[aria-label="Ask Mingo"]');
  if (!found) throw new Error('no widget');
  return found;
};

function pointer(type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  act(() => {
    button().dispatchEvent(event);
  });
}

describe('settle', () => {
  it('goes to the nearer side, at the height it was let go, above the bar', () => {
    expect(settle(100, 500, WINDOW, BAR)).toEqual({ side: 'left', lift: 1024 - BAR - 16 - 522 });
    expect(settle(700, 500, WINDOW, BAR).side).toBe('right');
  });

  it('stays inside the window: never under the bar, never under the top bar', () => {
    expect(settle(700, 1000, WINDOW, BAR).lift).toBe(0);
    expect(settle(700, 0, WINDOW, BAR).lift).toBe(maxLift(WINDOW.height, BAR));
  });
});

describe('MingoDockWidget', () => {
  beforeEach(() => {
    onOpen.mockClear();
    localStorage.clear();
    Object.assign(window, { innerWidth: WINDOW.width, innerHeight: WINDOW.height });
    HTMLElement.prototype.setPointerCapture = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('sits in the bottom right corner above the bar by default', () => {
    render();
    expect(button().style.right).toBe('16px');
    expect(button().style.bottom).toBe(`${BAR + 16}px`);
  });

  it('opens the chat on a tap', () => {
    render();
    pointer('pointerdown', 700, 880);
    pointer('pointerup', 701, 881);
    act(() => button().click());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('only moves on a drag, settles on the side it was let go on, and remembers it', () => {
    render();
    vi.spyOn(button(), 'getBoundingClientRect').mockReturnValue({ left: 80, top: 478 } as DOMRect);
    pointer('pointerdown', 700, 880);
    pointer('pointermove', 100, 500);
    pointer('pointerup', 100, 500);
    act(() => button().click());

    expect(onOpen).not.toHaveBeenCalled();
    expect(button().style.left).toBe('16px');
    expect(JSON.parse(localStorage.getItem('of.mingo-widget') ?? 'null')).toEqual(settle(102, 500, WINDOW, BAR));

    // The next page puts it where it was left.
    act(() => root.unmount());
    root = createRoot(container);
    render();
    expect(button().style.left).toBe('16px');
  });
});
