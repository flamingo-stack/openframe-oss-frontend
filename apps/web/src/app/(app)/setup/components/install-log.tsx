'use client';

import { Collapse01Icon, Expand01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { ScrollFadeOverlay, Tag, useScrollFade } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect, useState } from 'react';
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

/**
 * The box itself, mounted with its first line: the scroll fades measure the
 * scroller from mount, so it has to exist by then. Each edge fades where more
 * of the log continues past it - the older lines above while it follows the
 * tail, the newer ones below once scrolled up, and either side of a long line.
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

  return (
    <div className="relative w-full overflow-hidden rounded-md border border-ods-border bg-ods-card">
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
