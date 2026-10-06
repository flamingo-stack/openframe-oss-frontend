'use client';

import {
  type DeviceFilterInput,
  DEVICE_STATUS,
  ErrorBoundary,
  type PackageSearchSlotProps,
  PackageSearchFieldPlaceholder,
  SoftwareActionForm,
  type SoftwareDeviceScope,
  type SoftwareScheduleTiming,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { Suspense, useMemo } from 'react';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { TIME_REFERENCE_OPTIONS } from '@/app/(app)/scripts/schedule/types/edit-schedule.types';
import {
  earliestScheduleDay,
  getTimeSlotOptions,
  isScheduleStartInPast,
  PAST_START_MESSAGE,
} from '@/app/(app)/scripts/schedule/utils/schedule-timing';
import { ServerDevicePickerSkeleton } from '@/app/components/shared/device-selector/server-device-picker-lists';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { ScheduleTimeReference, type SoftwareAction } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { BundleDevicePicker } from './bundle-device-picker';
import { PackageSearchField } from './package-search-field';
import { useDraftBundle } from './use-draft-bundle';
import { useSoftwareActionSubmit } from './use-software-action-submit';

function agentMissing(device: Device): string | undefined {
  return device.machineId ? undefined : 'Agent is not\nconnected';
}

/** Date / Time / Timezone read exactly as a script schedule's start is. */
const SCHEDULE_TIMING: SoftwareScheduleTiming<ScheduleTimeReference> = {
  timeReferenceOptions: TIME_REFERENCE_OPTIONS,
  getTimeOptions: getTimeSlotOptions,
  getEarliestDay: earliestScheduleDay,
  getStartError: (date, time, timeReference) =>
    isScheduleStartInPast(date, time, timeReference) ? PAST_START_MESSAGE : undefined,
};

const INITIAL_VALUES = { timeReference: ScheduleTimeReference.SERVER };

/** "Software Name": the catalog search, behind its own boundaries so a failed search does not take the form down. */
function renderPackageSearch({ packageManager, value, onChange }: PackageSearchSlotProps) {
  return (
    // Keyed by catalog: a new package manager starts a new search.
    <ErrorBoundary key={packageManager} fallback={<PackageSearchFieldPlaceholder error="Couldn't search packages." />}>
      <Suspense fallback={<PackageSearchFieldPlaceholder />}>
        <PackageSearchField packageManager={packageManager} value={value} onChange={onChange} />
      </Suspense>
    </ErrorBoundary>
  );
}

interface ScopedBundleDevicePickerProps {
  osTypesKey: string;
  bundleId: string | null;
  createError: Error | null;
  onRetryCreate: () => void;
}

/**
 * The picker within the form's frame: live devices on the OS the chosen
 * packages install on. Keyed by the OS list's text so a re-render with the
 * same rows keeps the same object: the picker's queries and facets are keyed by it.
 */
function ScopedBundleDevicePicker({ osTypesKey, bundleId, createError, onRetryCreate }: ScopedBundleDevicePickerProps) {
  const scope = useMemo<DeviceFilterInput>(
    () => ({ statuses: [DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE], osTypes: osTypesKey.split(',') }),
    [osTypesKey],
  );
  return (
    <BundleDevicePicker
      bundleId={bundleId}
      createError={createError}
      onRetryCreate={onRetryCreate}
      scope={scope}
      isDeviceDisabled={agentMissing}
    />
  );
}

/**
 * Install Software (design 591:8524) and Update Software (409:48080 / 409:48175):
 * the container of the core library's `SoftwareActionForm`.
 *
 * The packages and the timing are the form's own state; the devices are not.
 * They live on a draft bundle this page opens (`useDraftBundle`) and every
 * assignment edits in place, so the selection is never held in the browser, and
 * submit sends the bundle's id, not a list (`useSoftwareActionSubmit`).
 */
export function SoftwareActionView({
  action,
  loading = false,
}: {
  action: SoftwareAction;
  /** The module's flag has not answered yet: the form draws, the picker does not fetch and nothing submits. */
  loading?: boolean;
}) {
  const handleBack = useSafeBack(routes.software.actions);
  const { bundleId, deviceCount, createError, retryCreate, markSubmitted } = useDraftBundle({ enabled: !loading });
  const { submit, isSubmitting } = useSoftwareActionSubmit(action, { onSubmitted: markSubmitted });

  const renderDevicePicker = ({ osTypesKey }: SoftwareDeviceScope) =>
    loading ? (
      <ServerDevicePickerSkeleton />
    ) : (
      <ScopedBundleDevicePicker
        // A new OS set is a different candidate list, not a refetch of this
        // one: remounting drops straight to the skeleton instead of leaving
        // the previous OS's devices on screen, and addable, while the
        // deferred query catches up. The picker's search and funnels go with
        // it, which is right: they narrowed a list that no longer exists.
        key={osTypesKey}
        osTypesKey={osTypesKey}
        bundleId={bundleId}
        createError={createError}
        onRetryCreate={retryCreate}
      />
    );

  return (
    <SoftwareActionForm<ScheduleTimeReference>
      action={action}
      onBack={handleBack}
      onSubmit={values => submit({ ...values, bundleId, deviceCount })}
      submitDisabled={loading || deviceCount === 0}
      submitting={isSubmitting}
      timing={SCHEDULE_TIMING}
      initialValues={INITIAL_VALUES}
      renderPackageSearch={renderPackageSearch}
      renderDevicePicker={renderDevicePicker}
    />
  );
}
