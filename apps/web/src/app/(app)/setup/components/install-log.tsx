'use client';

import { Collapse01Icon, Expand01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { ScrollFadeOverlay, Tag, useScrollFade } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type RefObject, useEffect, useLayoutEffect, useState } from 'react';
import {
  DEVICE_LOG_LEVEL_COLUMN,
  DEVICE_LOG_LINE,
  DEVICE_LOG_LIST_CLASS,
  DEVICE_LOG_TIME_COLUMN,
} from '@/app/(app)/devices/components/tabs/device-logs/device-log-layout';
import { deviceLogLevelVariant } from '@/app/(app)/devices/utils/device-log-level';
import { formatLogTime } from '@/lib/format-date';
import { type InstallLogRow, type InstallOutputLine, toInstallLogRows } from '../lib/install-log-line';

/**
 * What the installer prints, in the Agent Logs columns (time · level · message)
 * inside a box under the buttons that follows the newest line while it is
 * short, and opens to the whole log from the control in its corner. Unlike an
 * Agent Logs row a line has no drawer to open, so it is never cut: lines keep
 * their terminal shape and the box scrolls sideways to the longest. Nothing is
 * drawn before the first line: the waiting is told by the progress list under
 * it, not by a box of its own.
 */
export function InstallLog({ lines }: { lines: InstallOutputLine[] }) {
  const rows = toInstallLogRows(lines);

  return rows.length === 0 ? null : <InstallLogBox rows={rows} />;
}

/** The fades are 40px, the design's scroll gradient; they fade into the box's own surface. */
const FADE_COLOR = 'var(--color-bg-card)';
const VERTICAL_FADE_CLASS = 'h-10';
/** The shortest the opened-out log gets: the closed box's height (`max-h-40`). */
const MIN_EXPANDED_HEIGHT = 160;

/**
 * Opened out, the log takes all the height the window has left: its own height
 * plus the slack in the frame's centred `<main>`, less whatever already runs
 * past the window, so the page itself never scrolls. Re-measured as the window
 * or the step around the log changes (the progress list grows under it).
 * Written to the element, not to state: each measure reads the layout the
 * last write produced, and a stable layout writes nothing.
 */
function useFillWindowHeight(scrollRef: RefObject<HTMLDivElement | null>, expanded: boolean) {
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const main = scroller?.closest('main');
    const content = main?.firstElementChild;
    if (!expanded || !scroller || !main || !(content instanceof HTMLElement)) return undefined;
    const root = document.documentElement;
    const fit = () => {
      const style = getComputedStyle(main);
      const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const slack = Math.max(0, main.clientHeight - padding - content.offsetHeight);
      const overflow = Math.max(0, root.scrollHeight - root.clientHeight);
      const next = Math.max(MIN_EXPANDED_HEIGHT, scroller.offsetHeight + slack - overflow);
      if (Math.abs(next - scroller.offsetHeight) > 1) scroller.style.height = `${next}px`;
    };
    fit();
    // The step around the log changes size with the progress list; the window
    // only with itself - a page taller than the window keeps its own size as the
    // window shrinks, so nothing in it would say. The wizard is drawn bare, with
    // no docked panel beside it, so the window is the page's room.
    const observer = new ResizeObserver(fit);
    observer.observe(content);
    window.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
      scroller.style.height = '';
    };
  }, [expanded, scrollRef]);
}

/**
 * The box itself, mounted with its first line: the scroll fades measure the
 * scroller from mount, so it has to exist by then. Each edge fades where more
 * of the log continues past it - the older lines above while it follows the
 * tail, the newer ones below once scrolled up, and either side of a long line.
 * Closed it is the controls' 600px; opened out it widens to 900px and takes
 * the height the window has left.
 */
function InstallLogBox({ rows }: { rows: InstallLogRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const { scrollRef, fadeTop, fadeBottom, fadeLeft, fadeRight, update } = useScrollFade<HTMLDivElement>('both');

  // Follow the tail while the box is short, on each new line - not on every
  // render, which the step's enrollment poll causes and which would pull a
  // reader scrolled up back down. The whole log needs no following.
  const rowCount = rows.length;
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || expanded || rowCount === 0) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [rowCount, expanded, scrollRef]);
  useFillWindowHeight(scrollRef, expanded);

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-md border border-ods-border bg-ods-card',
        expanded ? 'max-w-[900px]' : 'max-w-[600px]',
      )}
    >
      <div
        ref={scrollRef}
        onScroll={update}
        role="log"
        aria-label="Installer output"
        aria-live="polite"
        className={cn(
          'overflow-auto py-[var(--spacing-system-xxs)] pr-[var(--spacing-system-l)]',
          expanded ? 'max-h-none' : 'max-h-40',
        )}
      >
        {/* As wide as the longest line, never narrower than the box: the rows share one width to scroll by. */}
        <ul className={cn(DEVICE_LOG_LIST_CLASS, 'w-max min-w-full')}>
          {rows.map((row, index) => (
            // The log only grows, so a row's position is its identity.
            <li key={index} className={DEVICE_LOG_LINE}>
              <span className={cn(DEVICE_LOG_TIME_COLUMN, 'shrink-0 tabular-nums text-ods-text-secondary text-code')}>
                {formatLogTime(row.time)}
              </span>
              <span className={cn(DEVICE_LOG_LEVEL_COLUMN, 'flex shrink-0')}>
                <Tag
                  as="span"
                  label={<span>{row.level}</span>}
                  variant={deviceLogLevelVariant(row.level)}
                  className="max-w-full"
                />
              </span>
              <span className="whitespace-pre text-ods-text-primary text-code">{row.message}</span>
            </li>
          ))}
        </ul>
      </div>
      <ScrollFadeOverlay edge="top" visible={fadeTop} color={FADE_COLOR} className={VERTICAL_FADE_CLASS} />
      <ScrollFadeOverlay edge="bottom" visible={fadeBottom} color={FADE_COLOR} className={VERTICAL_FADE_CLASS} />
      <ScrollFadeOverlay edge="left" visible={fadeLeft} color={FADE_COLOR} />
      <ScrollFadeOverlay edge="right" visible={fadeRight} color={FADE_COLOR} />
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
