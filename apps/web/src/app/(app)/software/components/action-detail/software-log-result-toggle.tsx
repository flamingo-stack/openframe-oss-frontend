'use client';

import { Chevron02DownIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useResultPhasesContext } from './use-result-phases';

/**
 * The result column's cell: binds the toggle to its row's phase through
 * `ResultPhasesContext`, so the column definition itself captures nothing that
 * changes (see the context for why that matters).
 */
export function SoftwareLogResultToggleCell({ id }: { id: string }) {
  const { phases, toggle } = useResultPhasesContext();
  // Static chrome: while the row is read (a loading scope) it is drawn for real and inert.
  const loading = useLoadingScope();
  return <SoftwareLogResultToggle open={phases.get(id) === 'open'} onToggle={() => toggle(id)} disabled={loading} />;
}

/** The row's "Show Result" / "Hide Result" control. */
export function SoftwareLogResultToggle({
  open,
  onToggle,
  disabled = false,
}: {
  open: boolean;
  onToggle: () => void;
  /** Drawn for real and inert (a row still being read). */
  disabled?: boolean;
}) {
  const chevron = (
    <Chevron02DownIcon
      className={cn('transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')}
    />
  );
  const label = open ? 'Hide Result' : 'Show Result';
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      {/* The design's split button on md+, a fixed 176px so "Show" and "Hide"
          don't resize it; `fullWidth` keeps the chevron flush right. Below md the
          column is one icon wide. */}
      <div className="hidden w-[176px] content-md:block">
        <Button
          variant="outline"
          fullWidth
          onClick={onToggle}
          disabled={disabled}
          aria-expanded={open}
          splitIcon={chevron}
        >
          <ToggleLabel open={open} />
        </Button>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={open}
        aria-label={label}
        leftIcon={chevron}
        className="bg-ods-card content-md:hidden"
      />
    </div>
  );
}

const LABELS = [
  { text: 'Show Result', when: false },
  { text: 'Hide Result', when: true },
] as const;

/**
 * Both labels stacked in one grid cell, the inactive one faded out. The button
 * is a fixed 176px, but a lone centered label re-centers by the width
 * difference when it swaps ("Show" is wider than "Hide"), which reads as the
 * button resizing. The cell is as wide as the wider label, and right-aligning
 * inside it keeps "Result" where it is while the first word cross-fades — the
 * same 200ms as the chevron's turn.
 */
function ToggleLabel({ open }: { open: boolean }) {
  return (
    <span className="grid text-right">
      {LABELS.map(({ text, when }) => (
        <span
          key={text}
          aria-hidden={open !== when}
          className={cn(
            'col-start-1 row-start-1 transition-opacity duration-200 motion-reduce:transition-none',
            open !== when && 'opacity-0',
          )}
        >
          {text}
        </span>
      ))}
    </span>
  );
}
