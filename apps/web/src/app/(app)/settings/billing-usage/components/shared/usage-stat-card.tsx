'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';

/**
 * How the counter is doing against whatever bounds it.
 *
 * - `warning` — heading for the limit: devices past the package, an AI balance
 *   running low, a trial that has spent its grant. It costs more, or it is
 *   about to stop.
 * - `error` — the limit is reached and something has actually stopped.
 */
export type UsageStatTone = 'default' | 'warning' | 'error';

interface UsageStatCardProps {
  title: string;
  /** Headline figure. A node, so a unit or a total can trail it in secondary text. Unread while loading. */
  value?: ReactNode;
  /** The line under the figure — what it is measured against, or how it is billed. Unread while loading. */
  caption?: ReactNode;
  /** Its subscription has not answered: the card draws its own skeleton (as it does in a loading scope). */
  loading?: boolean;
  /**
   * Recolours the whole card — border, fill and every line. Whole-card, not an
   * added badge: the figure itself is the problem, and the block below spells
   * out what it costs.
   */
  tone?: UsageStatTone;
  /** Pinned to the card's top-right corner, outside the text flow (e.g. a help popover). */
  trailing?: ReactNode;
}

/** The card's frame and its two rows. */
const CARD_CLASS =
  'group/stat relative flex min-w-0 flex-1 flex-col justify-center gap-[var(--spacing-system-xsf)] rounded-md border p-[var(--spacing-system-mf)]';
const TITLE_CLASS = 'truncate text-h5';
const VALUE_CLASS = 'truncate text-h2';
const CAPTION_CLASS = 'truncate text-h6';

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
export function UsageStatCard({
  title,
  value,
  caption,
  tone = 'default',
  trailing,
  loading: loadingProp,
}: UsageStatCardProps) {
  // While its figure is on its way: the title and the trailing control are fixed and stay real; the figure and the
  // caption (as query-dependent as the figure: a trial's end date, "Annual Prepaid", "Pay as you go") are bars, on the
  // default tone (the tone is read data too).
  const loading = useLoadingScope() || !!loadingProp;
  const shownTone = loading ? 'default' : tone;
  return (
    // The state travels to the value/caption slots as an attribute rather than a
    // prop: both are nodes built by the caller, so the card cannot pass anything
    // into them — and a `StatSuffix`/`StatEmphasis` left on its own grey is the
    // one part of a recoloured card that stays unrecoloured.
    <div data-tone={shownTone} className={cn(CARD_CLASS, TONE_CARD[shownTone])}>
      <div className="flex flex-col">
        <p className={cn(TITLE_CLASS, TONE_TEXT[shownTone])}>{title}</p>
        {loading ? (
          <TextLineSkeleton type="h2" className="w-24" />
        ) : (
          <p className={cn(VALUE_CLASS, TONE_VALUE[shownTone])}>{value}</p>
        )}
      </div>
      {loading ? (
        <TextLineSkeleton type="h6" className="w-32" />
      ) : (
        <p className={cn(CAPTION_CLASS, TONE_TEXT[shownTone])}>{caption}</p>
      )}
      {trailing && (
        <div
          className={cn(
            'absolute right-[var(--spacing-system-mf)] top-[var(--spacing-system-mf)]',
            TONE_TEXT[shownTone],
          )}
        >
          {trailing}
        </div>
      )}
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
 * otherwise a label ("Trial Period ends **12/15/26**", "**$50.00** balance").
 * Lifted to the primary text colour — the caption's own grey is the label's,
 * not the value's.
 */
export function StatEmphasis({ children }: { children: ReactNode }) {
  return (
    <span className="text-ods-text-primary group-data-[tone=error]/stat:text-ods-error group-data-[tone=warning]/stat:text-ods-warning">
      {children}
    </span>
  );
}
