'use client';

import { createContext, useContext, useState } from 'react';

/**
 * Where a row's result panel is. `opening` is mounted but still collapsed — one
 * frame later it turns `open`, which is what lets the rows transition run on a
 * freshly mounted panel. `closing` stays mounted until the collapse ends.
 * Absent = not mounted: the core row draws a divider under its cells whenever a
 * sub-row is present, so a collapsed panel must not linger.
 */
export type ResultPhase = 'opening' | 'open' | 'closing';

function withPhase(
  phases: ReadonlyMap<string, ResultPhase>,
  id: string,
  phase: ResultPhase | null,
): ReadonlyMap<string, ResultPhase> {
  const next = new Map(phases);
  if (phase) next.set(id, phase);
  else next.delete(id);
  return next;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

interface ResultPhases {
  phases: ReadonlyMap<string, ResultPhase>;
  /** Opens a closed row's panel, or starts closing an open one. */
  toggle: (id: string) => void;
  /** The row's collapse transition ended — unmount its panel. */
  collapsed: (id: string) => void;
}

/** Which rows' result panels are mounted, and how far each one is through its transition. */
export function useResultPhases(): ResultPhases {
  const [phases, setPhases] = useState<ReadonlyMap<string, ResultPhase>>(() => new Map());

  const toggle = (id: string) => {
    setPhases(prev => {
      const phase = prev.get(id);
      // Still collapsed: nothing to animate, so no transition end would ever
      // report — `closing` would leave the panel (and the row's divider) mounted.
      if (phase === 'opening') return withPhase(prev, id, null);
      if (phase === 'open') {
        // No transition runs under reduced motion, so nothing would report the end.
        return withPhase(prev, id, prefersReducedMotion() ? null : 'closing');
      }
      return withPhase(prev, id, 'opening');
    });
    // Two frames: the first commits the collapsed panel, the second is painted
    // with it, so switching to `open` animates instead of snapping.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setPhases(prev => (prev.get(id) === 'opening' ? withPhase(prev, id, 'open') : prev))),
    );
  };

  const collapsed = (id: string) => {
    setPhases(prev => (prev.get(id) === 'closing' ? withPhase(prev, id, null) : prev));
  };

  return { phases, toggle, collapsed };
}

/** What a result cell needs from the table: the row's phase and the toggle. */
export interface ResultPhasesBinding {
  phases: ReadonlyMap<string, ResultPhase>;
  toggle: (id: string) => void;
}

/**
 * How the result cells reach the phases. TanStack's `flexRender` renders a
 * column's `cell` function AS a component, keyed on the function's identity —
 * so a column definition that closes over the phases is rebuilt on every
 * toggle, and every cell in every row unmounts and remounts with it: hover is
 * lost, the chevron and the label land in their end state with no transition.
 * The definitions stay constant and the cell reads the live values from here.
 */
export const ResultPhasesContext = createContext<ResultPhasesBinding | null>(null);

export function useResultPhasesContext(): ResultPhasesBinding {
  const binding = useContext(ResultPhasesContext);
  if (!binding) throw new Error('useResultPhasesContext: no ResultPhasesContext.Provider above');
  return binding;
}
