'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeviceSelectionModeRadio, DeviceSelector } from '@/app/components/shared/device-selector';
import type { DeviceSelectionMode } from '@/app/components/shared/device-selector/device-selector.types';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { ScheduleCriteriaFieldsSkeleton } from './schedule-criteria-fields';
import { ScheduleInfoBarSkeleton } from './schedule-info-bar-skeleton';

const NO_DEVICES: never[] = [];

/**
 * The finish button's slot, not the button: `loadingActions` turns this into a
 * neutral bar. Which button it becomes is the schedule's own answer — a specific
 * assignment commits as it goes and exits through "Done", a rule is saved
 * through "Save Devices" — and a painted guess is a live-looking control that
 * changes meaning under the cursor.
 */
const LOADING_ACTIONS: PageActionButton[] = [{ label: 'Finish', variant: 'accent' }];

/**
 * The real picker in its loading state, so there is no separate skeleton to
 * drift.
 *
 * It takes the mode because the two halves are different surfaces — a card with
 * a tab strip and a search row versus bare fields over a preview. A switch
 * commits before its data arrives, so a skeleton of the half being LEFT would be
 * the wrong shape, and the layout would jump again the moment the real half
 * landed.
 *
 * Locked with `disabled`, NOT `readOnly`, and the difference is the tab strip:
 * `readOnly` forces `singleSelect`, which is the picker's one-device shape and
 * has no Available / Selected split — the loading card came out a header short
 * of the card it stands in for. `disabled` blocks every interaction and leaves
 * the shape alone. `showSelectionModeRadio` is off for the same reason the real
 * lists switch it off: the page draws the mode block itself, above the boundary.
 */
export function SchedulePickerSkeleton({ mode }: { mode: DeviceSelectionMode }) {
  return (
    <DeviceSelector
      devices={NO_DEVICES}
      loading
      disabled
      showSelectionModeRadio={false}
      selectionMode={mode}
      criteriaContent={mode === 'criteria' ? <ScheduleCriteriaFieldsSkeleton /> : undefined}
    />
  );
}

/**
 * The FIRST of the page's two loading states — the short one, while the settings
 * query is out and the mode is genuinely unknown.
 *
 * Everything whose SHAPE the mode cannot change is already here: the title, a
 * working Back, the info bar and the mode block itself, real and locked with
 * nothing marked. What is NOT here is the picker: its two halves are different
 * surfaces — a card with a tab strip and a search row versus bare criteria
 * fields — so drawing one would be answering the question this state is waiting
 * on. The finish button keeps a neutral slot for the same reason ("Done" vs
 * "Save Devices").
 *
 * The SECOND state is where the picker (tab strip and all) belongs, and the page
 * draws it itself: once the settings land, `ScheduleDevicesView` unlocks the
 * radio onto the stored mode and puts `SchedulePickerSkeleton` for THAT mode
 * under its own boundary while the devices load. Waiting for the small settings
 * query is what turns that skeleton from a guess into a fact — and the wait is
 * short, resolving from the Relay store outright when this page is reached from
 * the details page.
 */
export function ScheduleDevicesSkeleton({ scheduleId }: { scheduleId: string }) {
  const handleBack = useSafeBack(routes.scriptsV2.schedules.details(scheduleId));

  return (
    <PageLayout
      title="Schedule Devices"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={LOADING_ACTIONS}
      loadingActions
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <span role="status" className="sr-only">
        Loading schedule…
      </span>

      <div className="flex flex-col gap-[var(--spacing-system-l)]" inert>
        <ScheduleInfoBarSkeleton />
        {/* The REAL mode block, locked and with nothing marked: both rows are
            static copy, so only the SELECTION is data — and `''` is how this
            block says it has none yet. */}
        <DeviceSelectionModeRadio value="" disabled />
      </div>
    </PageLayout>
  );
}
