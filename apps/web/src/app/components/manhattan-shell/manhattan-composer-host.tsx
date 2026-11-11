'use client';

import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';

/**
 * The Manhattan v2 composer moves between two places with the work-area mode: the
 * bottom of the chat column (`chat`, `split`) and the dock under the page (`page`).
 * It must not remount on the way (plan C1): the draft, the staged context and the
 * uploads live in the session's one `EmbeddableChat`.
 *
 * So React renders it ONCE, through a portal, into a host element this module owns, and
 * the active slot moves that element (the DOM node, not the React tree) into itself.
 * React never sees the move: the portal's container is the same node wherever it hangs.
 */
interface ComposerHostStore {
  host: HTMLDivElement | null;
  /** The host has hung in a slot once: the portal renders from then on (its first layout reads a laid-out box). */
  attached: boolean;
  markAttached: () => void;
}

const useComposerHostStore = create<ComposerHostStore>()(set => ({
  host: typeof document === 'undefined' ? null : document.createElement('div'),
  attached: false,
  markAttached: () => set({ attached: true }),
}));

/** Renders `children` (the dock) once, into the moving host. Keep it mounted for the session. */
export function ManhattanComposerPortal({ children }: { children: ReactNode }) {
  const host = useComposerHostStore(s => s.host);
  const attached = useComposerHostStore(s => s.attached);
  if (!host || !attached) return null;
  return createPortal(children, host);
}

/**
 * A place the composer can be. The active one holds the host; exactly one slot is
 * active at a time (the caller derives both from the same mode). The old slot lets go
 * in its effect cleanup, which React runs before the new slot's effect in the same commit.
 */
export function ManhattanComposerSlot({ active, className }: { active: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const host = useComposerHostStore(s => s.host);
  const markAttached = useComposerHostStore(s => s.markAttached);
  useLayoutEffect(() => {
    const slot = ref.current;
    if (!active || !host || !slot) return undefined;
    slot.appendChild(host);
    markAttached();
    return () => {
      if (host.parentNode === slot) slot.removeChild(host);
    };
  }, [active, host, markAttached]);
  return <div ref={ref} className={className} data-composer-slot={active ? 'active' : undefined} />;
}
