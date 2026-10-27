'use client';

import { MingoEdgeLight } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { MingoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type PointerEvent as ReactPointerEvent, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';

/**
 * The composer folded into a button while a page's window-pinned action bar holds the
 * bottom of a phone or a tablet (`PageActions` below `md`): two bottom bars took a third
 * of the screen. A tap opens the composer under the bar again; the dock folds it back
 * (its ×, a tap outside the chat, another page).
 */
export const useMingoDockWidgetStore = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>(set => ({
  open: false,
  setOpen: open => set({ open }),
}));

/** The button's side: the edge it was let go nearer to. */
export type WidgetSide = 'left' | 'right';

export interface WidgetPosition {
  side: WidgetSide;
  /** Its distance above the action bar, px. */
  lift: number;
}

const POSITION_KEY = 'of.mingo-widget';
/** The default button's height (`h-11`). */
const SIZE = 44;
/** Its distance from the window's side and from the bar (`spacing-system-mf`). */
const GAP = 16;
/** Room left for the top bar (56px) above the highest place it can go. */
const TOP_CLEARANCE = 72;
/** A press that moves less than this is a tap, not a drag. */
const DRAG_THRESHOLD = 6;

const DEFAULT_POSITION: WidgetPosition = { side: 'right', lift: 0 };

function readPosition(): WidgetPosition {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null');
    if (parsed && typeof parsed === 'object' && 'side' in parsed && 'lift' in parsed) {
      const { side, lift } = parsed as { side: unknown; lift: unknown };
      if ((side === 'left' || side === 'right') && typeof lift === 'number' && lift >= 0) return { side, lift };
    }
  } catch {
    // No storage (a private window, a blocked origin): the default place.
  }
  return DEFAULT_POSITION;
}

function writePosition(position: WidgetPosition) {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(position));
  } catch {
    // A convenience: without storage it is only not remembered.
  }
}

/** The highest it can go above the bar in this window. */
export function maxLift(windowHeight: number, barHeight: number): number {
  return Math.max(0, windowHeight - barHeight - GAP - SIZE - TOP_CLEARANCE);
}

/** Where a button let go with its centre at (x, y) settles: on the nearer side, at its height, inside the window. */
export function settle(x: number, y: number, window: { width: number; height: number }, barHeight: number) {
  const bottom = y + SIZE / 2;
  const lift = window.height - barHeight - GAP - bottom;
  return {
    side: x < window.width / 2 ? 'left' : 'right',
    lift: Math.min(Math.max(0, lift), maxLift(window.height, barHeight)),
  } satisfies WidgetPosition;
}

const subscribeToNothing = () => () => {};

interface MingoDockWidgetProps {
  /** The action bar's height: the button stays above it. */
  barHeight: number;
  onOpen: () => void;
}

export function MingoDockWidget({ barHeight, onOpen }: MingoDockWidgetProps) {
  const onClient = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const [position, setPosition] = useState(readPosition);
  // The press in progress: where it started, and how far it has moved since.
  const press = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  // The click that ends a drag: it only puts the button down.
  const dropped = useRef(false);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);

  if (!onClient) return null;

  const lift = Math.min(position.lift, maxLift(window.innerHeight, barHeight));

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { x: event.clientX, y: event.clientY, dragging: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = press.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    start.dragging = true;
    setDrag({ dx, dy });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = press.current;
    press.current = null;
    if (!start?.dragging) return;
    dropped.current = true;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = settle(
      rect.left + SIZE / 2,
      rect.top + SIZE / 2,
      { width: window.innerWidth, height: window.innerHeight },
      barHeight,
    );
    setDrag(null);
    setPosition(next);
    writePosition(next);
  };

  return createPortal(
    <button
      type="button"
      aria-label="Ask Mingo"
      title="Ask Mingo"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        press.current = null;
        setDrag(null);
      }}
      // A tap opens the chat; the end of a drag only puts the button down.
      onClick={() => {
        if (dropped.current) {
          dropped.current = false;
          return;
        }
        onOpen();
      }}
      className={cn(
        'fixed z-40 flex h-11 w-11 touch-none select-none items-center justify-center rounded-[6px] border border-ods-border bg-ods-card text-ods-text-primary shadow-xl',
        !drag && 'transition-[left,right,bottom] duration-200 ease-out motion-reduce:transition-none',
      )}
      style={{
        [position.side]: GAP,
        bottom: barHeight + GAP + lift,
        transform: drag ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
      }}
    >
      <MingoEdgeLight className="rounded-[6px]" />
      <MingoIcon className="h-6 w-6" />
    </button>,
    document.body,
  );
}
