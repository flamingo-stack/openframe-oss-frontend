'use client';

import { Chevron02DownIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/** The row's "Show Result" / "Hide Result" control. */
export function SoftwareLogResultToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
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
      <div className="hidden w-[176px] md:block">
        <Button variant="outline" fullWidth onClick={onToggle} aria-expanded={open} splitIcon={chevron}>
          {label}
        </Button>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={label}
        leftIcon={chevron}
        className="bg-ods-card md:hidden"
      />
    </div>
  );
}
