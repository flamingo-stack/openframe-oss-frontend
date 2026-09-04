'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * Cells of the timing row, in `ScheduleInfoBarFromData`'s order. Bar widths trace
 * the real strings ("Date" is short, "Supported Platform" is not); `divided` marks
 * the two cells that carry the mobile row divider in the real bar.
 */
const CELLS = [
  { key: 'date', value: 'w-24', label: 'w-10', divided: true },
  { key: 'time', value: 'w-20', label: 'w-10', divided: true },
  { key: 'repeat', value: 'w-16', label: 'w-14' },
  { key: 'platform', value: 'w-12', label: 'w-32' },
];

/** One value/label pair, sized by the real typography rather than by fixed bar heights. */
function Cell({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-start justify-center px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)] md:h-[80px] md:py-0',
        className,
      )}
    >
      <div className="text-h4">
        <Skeleton className={cn('inline-block h-3 max-w-full md:h-4', value)} />
      </div>
      <div className="text-h6">
        <Skeleton className={cn('inline-block h-2.5 max-w-full md:h-3', label)} />
      </div>
    </div>
  );
}

/**
 * Mirrors `ScheduleInfoBarFromData` as the schedule pages use it: timing row +
 * a trailing row of two cells.
 *
 * The bars sit INSIDE elements carrying the real typography classes and are
 * shorter than the line they sit on, so each cell is sized by `text-h4`/`text-h6`
 * line-height — exactly what sizes the loaded bar — instead of by the bars
 * themselves. That is what makes it hold at every breakpoint: a fixed `h-6 mb-1`
 * + `h-5` pair measures 72px against the real 60px on mobile, and with three rows
 * the page drops ~36px the moment the schedule lands.
 *
 * The trailing row IS reserved, even though the real bar guards it with
 * `{ifDeviceOffline || addedBy && …}`: every schedule has an author and an
 * offline behavior, so the bar is two storeys tall in practice. The guard covers
 * a case the data does not produce, and dropping the row here would shorten the
 * block by 80px on every load.
 */
export function ScheduleInfoBarSkeleton() {
  return (
    <div className="flex w-full flex-col gap-0 overflow-clip rounded-[6px] border border-ods-border bg-ods-card">
      <div className="grid grid-cols-2 border-b border-ods-border md:grid-cols-4">
        {CELLS.map(cell => (
          <Cell
            key={cell.key}
            value={cell.value}
            label={cell.label}
            className={cell.divided ? 'border-b border-ods-border md:border-b-0' : undefined}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <Cell value="w-28" label="w-24" className="border-b border-ods-border md:border-b-0" />
        <Cell value="w-24" label="w-16" />
      </div>
    </div>
  );
}
