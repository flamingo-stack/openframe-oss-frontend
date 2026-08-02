'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { ArrowRightUpIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { ScriptSummaryCardSkeleton } from './script-summary-card';

const noop = () => {};

/**
 * The Run split button, disabled. Unlike the schedule header this one shows real
 * buttons rather than placeholders: Run is what an active script offers, and the
 * archived variant is the rarer branch that swaps in as soon as the record says
 * so. The title is static, so it needs no placeholder at all.
 */
const ACTIONS: PageActionButton[] = [
  {
    label: 'Run Script',
    variant: 'accent',
    disabled: true,
    iconAction: {
      icon: <ArrowRightUpIcon className="w-5 h-5" />,
      'aria-label': 'Open Run Script in new tab',
      onClick: noop,
    },
  },
];

/**
 * The script details header while the record is in flight — the REAL
 * `TitleBlock`, so it is pixel-identical in height to the loaded one and the
 * Back button already works.
 */
export function ScriptHeaderSkeleton() {
  const handleBack = useSafeBack(routes.scriptsV2.list);

  return (
    <TitleBlock
      title="Script Details"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={ACTIONS}
      actionsVariant="menu-primary"
    />
  );
}

/** Row of clickable tag chips under the title (mirrors the `Tag` outline chips). */
const TAG_CHIP_WIDTHS = ['w-28', 'w-24', 'w-40', 'w-32'];

/** The tag chips and the summary card before the script lands. */
export function ScriptSummarySkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-start gap-[var(--spacing-system-xs)]">
        {TAG_CHIP_WIDTHS.map(width => (
          <Skeleton key={width} className={`h-8 ${width} rounded-md`} />
        ))}
      </div>
      <ScriptSummaryCardSkeleton />
    </>
  );
}
