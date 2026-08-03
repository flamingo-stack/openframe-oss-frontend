'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';

/**
 * The shape the header settles into, not the header itself: `loadingActions`
 * turns each entry into a placeholder sized like the button it will become.
 * Placeholders rather than real buttons because WHICH actions exist is the thing
 * being loaded, and a painted button is both a flash of the wrong header and a
 * live click target acting on a guess.
 *
 * ONE entry, because one is all a schedule is guaranteed to have: an archived
 * one offers a single "Unarchive" where an active one offers Archive + Edit
 * Devices + Edit Schedule. Drawing three would promise two buttons that an
 * archived schedule never grows — and the action row is flush right, so
 * under-reserving costs nothing but a slot widening in place, while
 * over-reserving is a visible retraction. The label is what sizes the
 * placeholder (a label-less action collapses to a square icon button), so the
 * string matters even though it is never rendered.
 */
const LOADING_ACTIONS: PageActionButton[] = [{ label: 'Schedule action', variant: 'outline' }];

/**
 * The schedule details header while the record is in flight — the REAL
 * `TitleBlock`, so it is pixel-identical in height to the loaded one and the
 * Back button already works.
 *
 * Only the title and the action set wait. Nothing else on the page has a
 * placeholder at this level — the timing bar has its own, and each tab carries
 * its own below the tab bar.
 */
export function ScheduleHeaderSkeleton() {
  const handleBack = useSafeBack(routes.scriptsV2.schedules.list);

  return (
    <TitleBlock
      title=""
      loading
      loadingActions
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={LOADING_ACTIONS}
      actionsVariant="icon-buttons"
    />
  );
}
