'use client';

import { CalendarIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  DateFilterMenu,
  type DateFilterResult,
  type DateRange,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * A column header that hosts the date sort + range popover: the label and a
 * calendar icon, together opening `DateFilterMenu` (direction selector +
 * calendar, committed on Apply).
 *
 * Shared because the same header sits on every date-filtered list (Logs,
 * Customers' Last Activity, both Execution History tabs, Schedule Runs and
 * Scripts Schedules), and the parts that are easy to get subtly wrong are
 * exactly the parts that must not drift:
 * - The LABEL is inside the trigger, so the whole header cell opens the menu —
 *   the same hit area the filterable columns beside it have (the lib's funnel
 *   trigger is a full-width box, not the icon). With only the icon wrapped this
 *   column asked for a 16px target while its neighbours took the entire cell.
 * - Still the compact inline trigger rather than the lib's default 48px
 *   `Button`, which would make this header taller than the rest of the row.
 * - The accent state, which is the only thing telling the user a filter is
 *   applied at all.
 *
 * Rendered WITHOUT `filter` for a skeleton: same markup, inert. That is what
 * keeps the loading header identical to the loaded one — a bare label would
 * re-center the moment the calendar appeared with the rows.
 */
export interface TableDateFilter {
  /** Applied sort direction — `desc` is the backend's own default order. */
  sortDirection: 'asc' | 'desc';
  /** Applied range, restored from the URL. */
  range: DateRange | undefined;
  /** Fired on Apply with the drafted values, and on Reset with the defaults. */
  onApply: (result: DateFilterResult) => void;
}

export interface DateColumnHeaderProps {
  label: string;
  /** Omit for a skeleton header — the icon renders inert. */
  filter?: TableDateFilter;
  /**
   * What the trigger does, announced AFTER the visible label rather than in
   * place of it (see the `sr-only` span below). Override only when this column's
   * calendar does something the default sentence doesn't describe.
   */
  actionHint?: string;
}

export function DateColumnHeader({ label, filter, actionHint = 'Sort and filter by date' }: DateColumnHeaderProps) {
  // Accent whenever the list is narrowed or ordered by anything other than the
  // default — the header is the only place that says a date filter is active.
  const active = Boolean(filter && (filter.range || filter.sortDirection !== 'desc'));

  // Label + icon are one unit: whichever element wraps them is the hit area, so
  // the skeleton's inert <div> and the live <button> lay out identically.
  const content = (
    <>
      <span className="whitespace-nowrap text-ods-text-secondary transition-colors duration-200 text-h5 group-hover:text-ods-text-primary">
        {label}
      </span>
      <CalendarIcon
        className={cn(
          'h-4 w-4 transition-colors duration-200',
          active ? 'text-ods-accent' : 'text-ods-text-secondary group-hover:text-ods-text-primary',
        )}
      />
    </>
  );

  // No own vertical padding — the HeaderCell wrapper pads.
  const rowClassName = 'group flex w-full items-center gap-[var(--spacing-system-xsf)] select-none';

  if (!filter) {
    return <div className={rowClassName}>{content}</div>;
  }

  return (
    <DateFilterMenu
      mode="range"
      sort={filter.sortDirection}
      range={filter.range}
      onApply={filter.onApply}
      trigger={
        <button type="button" className={cn(rowClassName, 'cursor-pointer')}>
          {content}
          {/* The affordance is APPENDED to the visible label, not an `aria-label`
              replacing it: now that the label sits inside the button, an
              `aria-label` would be the button's whole accessible name and the
              column would go unnamed for screen readers (WCAG 2.5.3, Label in
              Name). `sr-only` is out of flow, so the row lays out unchanged. */}
          <span className="sr-only">{actionHint}</span>
        </button>
      }
    />
  );
}
