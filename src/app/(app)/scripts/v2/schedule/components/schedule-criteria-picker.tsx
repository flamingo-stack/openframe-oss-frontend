'use client';

import { useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  scheduleDevicePickerRelay_available$data as AvailableFragmentData,
  scheduleDevicePickerRelay_available$key as AvailableFragmentKey,
} from '@/__generated__/scheduleDevicePickerRelay_available.graphql';
import type { scheduleDevicePickerRelayPaginationQuery as AvailablePaginationQueryType } from '@/__generated__/scheduleDevicePickerRelayPaginationQuery.graphql';
import type { scheduleDevicePickerRelayQuery as AvailableQueryType } from '@/__generated__/scheduleDevicePickerRelayQuery.graphql';
import { useDeviceFilters } from '@/app/(app)/devices/hooks/use-device-filters';
import { DeviceSelector } from '@/app/components/shared/device-selector';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import {
  scheduleDevicePickerRelayFragment,
  scheduleDevicePickerRelayQuery,
} from '@/graphql/scripts/schedule-device-picker-relay';
import { criteriaToFilter, type ScheduleCriteria } from '../utils/schedule-criteria';
import { DEVICE_PICKER_PAGE_SIZE, toDevices, toRelayFilter, UNFILTERED } from '../utils/schedule-device-filters';
import { ScheduleCriteriaFields } from './schedule-criteria-fields';

interface ScheduleCriteriaPickerProps {
  scheduleId: string;
  criteria: ScheduleCriteria;
  onCriteriaChange: (next: ScheduleCriteria) => void;
  busy: boolean;
}

/**
 * The "Select Devices by Criteria" half — the rule editor over a live preview of
 * what it matches.
 *
 * The preview runs the rule through the schedule's `availableDevices`, the same
 * connection the Available list uses, with the criteria as its `filter`. That is
 * not a convenience: `ScheduleDeviceCriteriaInput` is a strict subset of
 * `DeviceFilterInput`, so the server answers "which devices does this rule
 * select?" itself — already scoped to the schedule's `supportedPlatforms`,
 * exactly as the stored rule will be. Nothing here re-implements the matching.
 *
 * It is also the right count: the field marks already-assigned devices with
 * `assigned` rather than withholding them, so the preview reads "devices the
 * rule targets", not "devices it would add".
 *
 * Nothing commits as you type. A rule is a single value the server replaces
 * whole, and applying it re-points the schedule at a live set, so it goes behind
 * the page's explicit Save.
 */
export function ScheduleCriteriaPicker({ scheduleId, criteria, onCriteriaChange, busy }: ScheduleCriteriaPickerProps) {
  const filter = useMemo(() => criteriaToFilter(criteria), [criteria]);
  // Editing the rule changes the preview's query variables. Deferring them
  // re-reads inside a transition, so the previous matches stay on screen instead
  // of the card dropping to its Suspense fallback on every click.
  const { deferredFilters: deferredFilter } = useDeferredQuery(filter, '');

  const data = useLazyLoadQuery<AvailableQueryType>(
    scheduleDevicePickerRelayQuery,
    { scheduleId, filter: toRelayFilter(deferredFilter), search: null, first: DEVICE_PICKER_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network' },
  );

  const preview = usePaginationFragment<AvailablePaginationQueryType, AvailableFragmentKey>(
    scheduleDevicePickerRelayFragment,
    data.scriptSchedule ?? null,
  );
  const connection = (preview.data as AvailableFragmentData | null)?.availableDevices;
  const rows = useMemo(() => toDevices(connection?.edges), [connection?.edges]);

  const loadMore = useCallback(() => {
    if (preview.hasNext && !preview.isLoadingNext) preview.loadNext(DEVICE_PICKER_PAGE_SIZE);
  }, [preview]);

  const { data: filterOptions } = useDeviceFilters(UNFILTERED);

  return (
    <DeviceSelector
      devices={rows}
      loading={false}
      disabled={busy}
      // The radio lives on the page; this only tells the picker to render as the
      // criteria surface — no card, no toolbar, no row actions.
      selectionMode="criteria"
      showSelectionModeRadio={false}
      totalCount={connection?.filteredCount ?? undefined}
      infiniteScroll={{
        hasNextPage: preview.hasNext,
        isFetchingNextPage: preview.isLoadingNext,
        onLoadMore: loadMore,
        skeletonRows: 2,
      }}
      criteriaContent={
        <ScheduleCriteriaFields
          criteria={criteria}
          onChange={onCriteriaChange}
          deviceFilters={filterOptions}
          disabled={busy}
        />
      }
    />
  );
}
