'use client';

import {
  Collapse01Icon,
  DotsLoaderIcon,
  Expand01Icon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect, useRef, useState } from 'react';

/**
 * What the installer prints, as the design draws it: a monospace box under the
 * buttons that follows the newest line while it is short, and opens to the
 * whole log from the control in its corner. Before the first line arrives the
 * box is the loader alone - the elevation prompt is up, or the download has
 * not said anything yet.
 */
export function InstallLog({ lines, running }: { lines: string[]; running: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Follow the tail while the box is short; the whole log needs no following.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || expanded) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [lines, expanded]);

  if (lines.length === 0) {
    if (!running) return null;
    return (
      <div className="flex w-full justify-center py-[var(--spacing-system-m)]" aria-live="polite" aria-busy>
        <DotsLoaderIcon className="size-6 text-ods-text-secondary" />
        <span className="sr-only">Waiting for the installer</span>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-md border border-ods-border bg-ods-card">
      <div
        ref={scrollerRef}
        role="log"
        aria-label="Installer output"
        aria-live="polite"
        className={cn(
          'overflow-y-auto px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)] pr-[var(--spacing-system-xl)]',
          expanded ? 'max-h-none' : 'max-h-40',
        )}
      >
        <pre className="whitespace-pre-wrap break-words font-[inherit] text-ods-text-primary text-code">
          {lines.join('\n')}
        </pre>
      </div>
      <button
        type="button"
        aria-label={expanded ? 'Show the latest lines only' : 'Show the whole log'}
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
        className="absolute bottom-[var(--spacing-system-xsf)] right-[var(--spacing-system-xsf)] flex size-6 items-center justify-center rounded-md text-ods-text-secondary transition-colors hover:text-ods-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
      >
        {expanded ? <Collapse01Icon size={16} /> : <Expand01Icon size={16} />}
      </button>
    </div>
  );
}
