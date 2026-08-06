'use client';

import { CalendarIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  DateFilterMenu,
  type DateFilterResult,
  type DateRange,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * A column header that hosts the date sort + range popover: the label, and a
 * calendar icon that opens `DateFilterMenu` (direction selector + calendar,
 * committed on Apply).
 *
 * Shared because the same header now sits on four lists (Customers' Last
 * Activity, both Execution History tabs and Schedule Runs), and the parts that
 * are easy to get subtly wrong are exactly the parts that must not drift: the
 * inline trigger (the lib's default is a 48px `Button`, which grows the header
 * row past every other column), and the accent state that tells the user a
 * filter is applied at all.
 *
 * Rendered WITHOUT `filter` for a skeleton: same markup, inert icon. That is
 * what keeps the loading header identical to the loaded one — a bare label
 * would re-center the moment the calendar appeared with the rows.
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
  /** Accessible label for the trigger, e.g. "Sort and filter by date". */
  ariaLabel?: string;
}

export function DateColumnHeader({ label, filter, ariaLabel = `Sort and filter by ${label}` }: DateColumnHeaderProps) {
  // Accent whenever the list is narrowed or ordered by anything other than the
  // default — the header is the only place that says a date filter is active.
  const active = Boolean(filter && (filter.range || filter.sortDirection !== 'desc'));

  const icon = (
    <CalendarIcon
      className={cn(
        'w-4 h-4 transition-colors duration-200',
        active ? 'text-ods-accent' : 'text-ods-text-secondary group-hover:text-ods-text-primary',
      )}
    />
  );

  return (
    // No own vertical padding — the HeaderCell wrapper pads.
    <div className="group flex items-center gap-[var(--spacing-system-xsf)] select-none">
      <span className="text-h5 text-ods-text-secondary whitespace-nowrap transition-colors duration-200 group-hover:text-ods-text-primary">
        {label}
      </span>
      {filter ? (
        <DateFilterMenu
          mode="range"
          sort={filter.sortDirection}
          range={filter.range}
          onApply={filter.onApply}
          // Compact inline trigger — keeps the header row height identical to
          // the other columns (the default lib trigger is a 48px Button).
          trigger={
            <button type="button" aria-label={ariaLabel} className="flex items-center">
              {icon}
            </button>
          }
        />
      ) : (
        <span className="flex items-center">{icon}</span>
      )}
    </div>
  );
}
