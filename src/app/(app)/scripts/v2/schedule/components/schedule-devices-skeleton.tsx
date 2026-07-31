'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeviceSelectionModeRadio, DeviceSelector } from '@/app/components/shared/device-selector';
import type { DeviceSelectionMode } from '@/app/components/shared/device-selector/device-selector.types';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { ScheduleCriteriaFieldsSkeleton } from './schedule-criteria-fields';
import { ScheduleInfoBarSkeleton } from './schedule-info-bar-skeleton';

const noop = () => {};
const NO_DEVICES: never[] = [];
const DONE_ACTION: PageActionButton[] = [{ label: 'Done', variant: 'accent', disabled: true }];

/**
 * The real picker in its loading state, so there is no separate skeleton to
 * drift.
 *
 * It takes the mode because the two halves are different surfaces — a card with
 * a tab strip and a search row versus bare fields over a preview. A switch
 * commits before its data arrives, so a skeleton of the half being LEFT would be
 * the wrong shape, and the layout would jump again the moment the real half
 * landed.
 */
export function SchedulePickerSkeleton({ mode }: { mode: DeviceSelectionMode }) {
  return (
    <DeviceSelector
      devices={NO_DEVICES}
      loading
      readOnly
      selectionMode={mode}
      criteriaContent={mode === 'criteria' ? <ScheduleCriteriaFieldsSkeleton /> : undefined}
    />
  );
}

/**
 * The "Edit Devices" page while its schedule query is in flight.
 *
 * Always the SPECIFIC half: which mode a schedule is in is the schedule's own
 * answer, and it has not arrived yet — specific is the default a new schedule
 * gets, so it is the better guess of the two.
 */
export function ScheduleDevicesSkeleton({ scheduleId }: { scheduleId: string }) {
  const handleBack = useSafeBack(routes.scriptsV2.schedules.details(scheduleId));

  return (
    <PageLayout
      title="Schedule Devices"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={DONE_ACTION}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]" inert>
        <ScheduleInfoBarSkeleton />
        <DeviceSelectionModeRadio value="specific" onChange={noop} disabled />
        <SchedulePickerSkeleton mode="specific" />
      </div>
    </PageLayout>
  );
}
