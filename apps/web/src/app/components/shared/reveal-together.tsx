'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/**
 * The longest a part that has answered waits for one that has not. Past it the page shows
 * what it has and the late part arrives on its own, as it would without the hold.
 */
export const REVEAL_CAP_MS = 4000;

interface RevealContextValue {
  held: boolean;
  report: (id: string, answered: boolean) => void;
}

const RevealContext = createContext<RevealContextValue | null>(null);

/**
 * Shows a page's sections in one go. Each section keeps reading and reports whether it has
 * answered (`useRevealPart`); while any has not, every one of them draws its loading form
 * (`useRevealHeld`), so the page goes from its skeleton to its content in one step instead of
 * a section at a time, and an optional block (absent while loading) appears in that same step.
 * Once shown it stays shown: a later refetch is the section's own.
 *
 * Not a loading scope on purpose: a reader under a scope runs no read (a Relay reader draws
 * its skeleton instead), so a scope here would wait on a read it stops.
 */
export function RevealTogether({ children }: { children: ReactNode }) {
  // A section's last answer. Kept when it unmounts: a section reports from the part of it that
  // stays mounted, and dropping it would let React's dev remount (cleanup, then report again,
  // one section at a time) read the first section to come back as the only one.
  const parts = useRef(new Map<string, boolean>());
  // The sections report in their layout effects, which run before this one on mount: until it
  // has run, the first section to report would read as the only one.
  const counted = useRef(false);
  const [held, setHeld] = useState(true);

  // Synchronous, from layout effects: the content replaces the skeleton before the browser paints.
  const settle = useCallback(() => {
    if (counted.current && [...parts.current.values()].every(Boolean)) setHeld(false);
  }, []);

  useLayoutEffect(() => {
    counted.current = true;
    settle();
  }, [settle]);

  const report = useCallback(
    (id: string, answered: boolean) => {
      parts.current.set(id, answered);
      settle();
    },
    [settle],
  );

  useEffect(() => {
    const timer = held ? setTimeout(() => setHeld(false), REVEAL_CAP_MS) : undefined;
    return () => clearTimeout(timer);
  }, [held]);

  return <RevealContext.Provider value={{ held, report }}>{children}</RevealContext.Provider>;
}

/**
 * A section of a `RevealTogether` page reports whether its read has answered (an error counts:
 * it has nothing more to wait for), from a part of it that stays mounted. Reported before paint,
 * so a section whose data is cached holds nothing back for a frame. Outside such a page it does
 * nothing.
 */
export function useRevealPart(id: string, answered: boolean): void {
  const report = useContext(RevealContext)?.report;
  useLayoutEffect(() => {
    report?.(id, answered);
  }, [report, id, answered]);
}

/** Whether the page still holds its sections in their loading form. False outside a `RevealTogether` page. */
export function useRevealHeld(): boolean {
  return useContext(RevealContext)?.held ?? false;
}
