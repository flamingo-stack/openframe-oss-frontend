'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';

/**
 * The shape the header settles into, not the header itself: `loadingActions`
 * below turns each of these into a placeholder sized like the button it will
 * become. Placeholders rather than the real buttons (which is what the script
 * header does) because WHICH actions exist is the thing being loaded — an
 * archived schedule offers a single "Unarchive" where an active one offers these
 * three — and a painted button is both a flash of the wrong header and a live
 * click target acting on a guess.
 *
 * Three entries, because three is what an active schedule has: core derives one
 * placeholder per action, so an empty list drew a single square box under a
 * header that was about to grow three labelled buttons. Labels are what size
 * them (a label-less action collapses to a square icon button), so the strings
 * matter even though none of them is rendered.
 */
const LOADING_ACTIONS: PageActionButton[] = [
  { label: 'Archive', variant: 'outline' },
  { label: 'Edit Devices', variant: 'outline' },
  { label: 'Edit Schedule', variant: 'outline' },
];

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
      subtitleRow="while-loading"
      loading
      loadingActions
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={LOADING_ACTIONS}
      actionsVariant="icon-buttons"
    />
  );
}
