'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';

/**
 * How the counter is doing against whatever bounds it.
 *
 * - `warning` — heading for the limit: devices past the package, AI spend
 *   approaching its cap. It costs more, or it is about to stop.
 * - `error` — the limit is reached and something has actually stopped.
 */
export type UsageStatTone = 'default' | 'warning' | 'error';

interface UsageStatCardProps {
  title: string;
  /** Headline figure. A node, so a unit or a total can trail it in secondary text. */
  value: ReactNode;
  /** The line under the figure — what it is measured against, or how it is billed. */
  caption: ReactNode;
  /**
   * Recolours the whole card — border, fill and every line. Whole-card, not an
   * added badge: the figure itself is the problem, and the block below spells
   * out what it costs.
   */
  tone?: UsageStatTone;
}

const TONE_CARD: Record<UsageStatTone, string> = {
  default: 'border-ods-border bg-ods-card',
  warning: 'border-ods-warning bg-ods-warning-secondary',
  error: 'border-ods-error bg-ods-error-secondary',
};

const TONE_TEXT: Record<UsageStatTone, string> = {
  default: 'text-ods-text-secondary',
  warning: 'text-ods-warning',
  error: 'text-ods-error',
};

const TONE_VALUE: Record<UsageStatTone, string> = {
  default: 'text-ods-text-primary',
  warning: 'text-ods-warning',
  error: 'text-ods-error',
};

/**
 * Headline counter with a caption beneath it — the billing page's top row.
 *
 * Not core's `DashboardInfoCard`: that card puts its secondary text BESIDE the
 * value (`subValue`) and reserves the right slot for a progress ring, at a fixed
 * height sized for exactly that. This row needs the caption on its own line and
 * no ring, which it has no variant for. So the composition lives here, in the
 * page that needs it, on the same ODS tokens the card is built from.
 */
export function UsageStatCard({ title, value, caption, tone = 'default' }: UsageStatCardProps) {
  return (
    // The state travels to the value/caption slots as an attribute rather than a
    // prop: both are nodes built by the caller, so the card cannot pass anything
    // into them — and a `StatSuffix`/`StatEmphasis` left on its own grey is the
    // one part of a recoloured card that stays unrecoloured.
    <div
      data-tone={tone}
      className={cn(
        'group/stat flex min-w-0 flex-1 flex-col justify-center gap-[var(--spacing-system-xsf)]',
        'rounded-md border p-[var(--spacing-system-mf)]',
        TONE_CARD[tone],
      )}
    >
      <div className="flex flex-col">
        <p className={cn('truncate text-h5', TONE_TEXT[tone])}>{title}</p>
        <p className={cn('truncate text-h2', TONE_VALUE[tone])}>{value}</p>
      </div>
      <p className={cn('truncate text-h6', TONE_TEXT[tone])}>{caption}</p>
    </div>
  );
}

/**
 * Trailing part of a figure that qualifies it rather than states it ("/10M").
 * Quieter than the figure by default; on a recoloured card it joins the rest of
 * the card, because "300/111" is one statement — the allocation left in grey
 * reads as a separate, unaffected number.
 */
export function StatSuffix({ children }: { children: ReactNode }) {
  return (
    <span className="text-ods-text-secondary group-data-[tone=error]/stat:text-ods-error group-data-[tone=warning]/stat:text-ods-warning">
      {children}
    </span>
  );
}

/**
 * The part of a caption that carries the information, inside a line that is
 * otherwise a label ("Trial Period ends **12/15/26**", "**$14.00** on next
 * invoice"). Lifted to the primary text colour — the caption's own grey is the
 * label's, not the value's.
 */
export function StatEmphasis({ children }: { children: ReactNode }) {
  return (
    <span className="text-ods-text-primary group-data-[tone=error]/stat:text-ods-error group-data-[tone=warning]/stat:text-ods-warning">
      {children}
    </span>
  );
}
