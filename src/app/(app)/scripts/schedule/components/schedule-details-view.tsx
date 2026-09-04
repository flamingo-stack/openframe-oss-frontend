'use client';

import { NotFoundError, Tag, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import {
  BoxArchiveIcon,
  InboxArrowUpIcon,
  LaptopIcon,
  PenEditIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type PageActionButton,
  type TabItem,
  TabNavigation,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { memo, Suspense, useCallback, useMemo, useState } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scheduleTriggerRelayQuery as ScheduleTriggerQueryType } from '@/__generated__/scheduleTriggerRelayQuery.graphql';
import type { scriptScheduleDetailRelayQuery as ScheduleDetailQueryType } from '@/__generated__/scriptScheduleDetailRelayQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { scheduleTriggerRelayQuery } from '@/graphql/scripts/schedule-trigger-relay';
import { scriptScheduleDetailRelayQuery } from '@/graphql/scripts/script-schedule-detail-relay';
import { decodeGlobalId } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { CONTEXT_ENTITY_KIND } from '../../../mingo/context/context-types';
import { useTrackOpenView } from '../../../mingo/context/use-track-open-view';
import { initiatorName } from '../../shared/utils/execution-helpers';
import { platformsToIds } from '../../shared/utils/script-mappers';
import { useScheduleArchive } from '../hooks/use-schedule-archive';
import { formatScheduleStartAt, isEventTrigger, offlineBehaviorToLabel, repeatToLabel } from '../utils/schedule-timing';
import { ArchiveScheduleModal } from './archive-schedule-modal';
import {
  SCHEDULE_DEFAULT_TAB,
  SCHEDULE_TABS_WITHOUT_RUNS,
  scheduleDetailTabs,
  scheduleTabBody,
} from './schedule-detail-tabs';
import { ScheduleHeaderSkeleton } from './schedule-details-skeleton';
import { ScheduleInfoBarFromData } from './schedule-info-bar';
import { ScheduleInfoBarSkeleton } from './schedule-info-bar-skeleton';

interface ScheduleDetailsViewProps {
  scheduleId: string;
}

/**
 * The header island: the title, the "Archived" tag and the ACTION SET are all
 * the record's own answer, so this is what waits for it.
 *
 * A missing schedule keeps the Back button and drops everything else — the way
 * out has to survive a bad id, and the timing bar below reports the miss once.
 */
function ScheduleHeader({ scheduleId }: ScheduleDetailsViewProps) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<ScheduleDetailQueryType>(
    scriptScheduleDetailRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const schedule = data.scriptSchedule;

  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const { isArchived, isArchiving, isPending, toggleArchive } = useScheduleArchive(schedule);

  // Back follows the list the schedule actually belongs to, so Back from an
  // archived schedule doesn't land the user on a list without it.
  const handleBack = useSafeBack(isArchived ? routes.scripts.schedules.archived : routes.scripts.schedules.list);

  // Mingo context carries the RAW db id (the route's `scheduleId` is the Relay
  // global id) — matching the picker + the `@scheduledScript:<id>` marker the
  // backend resolver expects. The mention chip re-encodes it for its fetch.
  const scheduleDbId = useMemo(() => decodeGlobalId(scheduleId)?.rawId ?? scheduleId, [scheduleId]);
  useTrackOpenView(
    schedule
      ? { type: CONTEXT_ENTITY_KIND.SCHEDULED_SCRIPT, id: scheduleDbId, label: schedule.name || scheduleDbId }
      : null,
  );

  const closeArchiveDialog = useCallback(() => setConfirmArchiveOpen(false), []);
  const handleArchiveToggle = useCallback(() => toggleArchive(closeArchiveDialog), [toggleArchive, closeArchiveDialog]);

  // An archived schedule runs on nothing, so editing it is meaningless — the one
  // thing worth offering is putting it back (design node 1:24107).
  const actions = useMemo<PageActionButton[]>(() => {
    if (!schedule) return [];
    return isArchived
      ? [
          {
            label: 'Unarchive',
            variant: 'outline' as const,
            onClick: handleArchiveToggle,
            icon: <InboxArrowUpIcon className="text-ods-text-secondary" />,
            disabled: isPending,
            loading: isPending,
          },
        ]
      : [
          {
            label: 'Archive',
            variant: 'outline' as const,
            // Archiving stops the schedule from running, so it asks first;
            // unarchiving above only puts it back and needs no confirmation.
            onClick: () => setConfirmArchiveOpen(true),
            icon: <BoxArchiveIcon className="text-ods-text-secondary" />,
            disabled: isPending,
            loading: isPending,
          },
          {
            label: 'Edit Devices',
            variant: 'outline' as const,
            href: routes.scripts.schedules.devices(scheduleId),
            icon: <LaptopIcon className="text-ods-text-secondary" />,
          },
          {
            label: 'Edit Schedule',
            variant: 'outline' as const,
            href: routes.scripts.schedules.edit(scheduleId),
            icon: <PenEditIcon className="text-ods-text-secondary" />,
          },
        ];
  }, [schedule, scheduleId, isArchived, handleArchiveToggle, isPending]);

  return (
    <>
      <TitleBlock
        // The schedule names its own page (design node 1:48789). `while-loading`
        // rather than `always`: the description line is drawn while the header is
        // loading, but a schedule that has none settles one line shorter instead
        // of keeping an empty row forever.
        title={schedule?.name}
        subtitle={schedule?.description ?? undefined}
        subtitleRow="while-loading"
        titleAdornment={isArchived ? <Tag label="Archived" variant="grey" /> : undefined}
        backButton={{ label: 'Back', onClick: handleBack }}
        actions={actions}
        actionsVariant="icon-buttons"
      />

      <ArchiveScheduleModal
        open={confirmArchiveOpen}
        onOpenChange={setConfirmArchiveOpen}
        onConfirm={handleArchiveToggle}
        isPending={isArchiving}
      />
    </>
  );
}

/**
 * The timing bar island. Reads the SAME query as the header with the same
 * variables, so Relay dedupes them into one request and both render from the
 * store afterwards.
 *
 * It is also the page's single not-found report: it is the first block under the
 * header, and every other island stays quiet about a missing schedule so the
 * page says it once.
 */
function ScheduleInfoBar({ scheduleId }: ScheduleDetailsViewProps) {
  // Shares the header's key deliberately. NOT for network dedupe — that is keyed
  // on `operation.request.identifier` (`loadQuery.js`), which does not contain
  // `fetchKey`, so mismatched keys still share one in-flight request. The reason
  // is `QueryResource`: it retains a REJECTION for 5 minutes keyed by
  // cacheIdentifier, which DOES contain `fetchKey`. A sibling left unkeyed
  // replays that retained error on remount and re-trips the boundary the Retry
  // just cleared.
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<ScheduleDetailQueryType>(
    scriptScheduleDetailRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const schedule = data.scriptSchedule;

  if (!schedule) {
    return <NotFoundError message="Schedule not found" />;
  }

  const { date, time } = formatScheduleStartAt(schedule.startAt, schedule.timeReference);

  // A DEVICE_ONLINE schedule waits for the device by definition, so the offline
  // setting does not apply — the edit form hides its block for the same reason,
  // and a value shown here that cannot be edited there would read as a setting
  // the page had lost.
  const ifDeviceOffline = isEventTrigger(schedule.trigger)
    ? undefined
    : offlineBehaviorToLabel(schedule.offlineBehavior, schedule.reconnectWindowSeconds);

  // No name / note row: the page title carries them (design node 260:44649).
  return (
    <ScheduleInfoBarFromData
      date={date}
      time={time}
      repeat={repeatToLabel(schedule.repeat)}
      platforms={platformsToIds(schedule.supportedPlatforms)}
      trigger={schedule.trigger}
      addedBy={initiatorName(schedule.author)}
      ifDeviceOffline={ifDeviceOffline}
    />
  );
}

/**
 * The tab strip and whichever body it is on.
 *
 * `tabs` is a prop rather than a constant because the SET depends on the
 * schedule: an event-driven one has no Schedule Runs (see
 * `scheduleDetailTabs`). Split out so the strip can be rendered both from the
 * island below and from its own fallback, with no other difference between them.
 */
function ScheduleTabs({ scheduleId, tabs }: ScheduleDetailsViewProps & { tabs: TabItem[] }) {
  return (
    // `TabNavigation` renders as a fragment, so its bar and its body are
    // siblings — left as direct children of the page column they would be pushed
    // apart by its `gap`. Grouped here into ONE flex item instead: the bar sits
    // flush on the body, and each tab body owns the top padding that separates
    // it from the bar.
    <div className="flex flex-col">
      {/* Each tab brings its own body, its own boundary and its own skeleton
          (see `schedule-detail-tabs.ts`) — this page renders whichever one the
          strip is on and knows nothing else about them. */}
      <TabNavigation tabs={tabs} urlSync defaultTab={SCHEDULE_DEFAULT_TAB}>
        {activeTab => {
          const TabBody = scheduleTabBody(activeTab);
          return <TabBody scheduleId={scheduleId} />;
        }}
      </TabNavigation>
    </div>
  );
}

/**
 * The tab island: it reads the one field that decides which tabs exist.
 *
 * Its own tiny query, not the page's detail query — see
 * `schedule-trigger-relay.ts`. Coming from the schedules list (which selects
 * `trigger`) it answers from the Relay store and this never suspends, so the
 * strip still paints with the rest of the page chrome; a cold load — a link
 * straight into the page — falls back to the certain tabs for one round trip.
 *
 * A stale `?tab=runs` needs no handling: `TabNavigation` resolves a tab id that
 * is not in `tabs` to `defaultTab`, so a link into the Runs tab of a schedule
 * that has since become event-driven lands on Scheduled Scripts.
 */
function ScheduleTabsIsland({ scheduleId }: ScheduleDetailsViewProps) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<ScheduleTriggerQueryType>(
    scheduleTriggerRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  return <ScheduleTabs scheduleId={scheduleId} tabs={scheduleDetailTabs(data.scriptSchedule?.trigger)} />;
}

/**
 * Schedule details page.
 *
 * Deliberately NOT `PageLayout`: it takes the title as a prop, so a page whose
 * title is server data would have to suspend as a whole and every visit would
 * start as a full-page placeholder. Here the page draws `PageLayout`'s own two
 * boxes and composes the frozen `TitleBlock` directly, so only the pieces that
 * actually read the record suspend — the container, the page padding and the tab
 * bar need no data and paint immediately.
 *
 * The header and the timing bar issue the same query with the same variables;
 * Relay dedupes identical in-flight requests, so mounting them in one commit
 * still costs a single round trip.
 *
 * **Memoized on purpose.** The route component reads `?id=` through
 * `useSearchParams()`, which re-renders on ANY query change — including the
 * `?tab=` this page writes on every tab click. `scheduleId` is the only thing
 * that flows in, and it does not change; `TabNavigation` reads `?tab=` itself,
 * so browser back/forward still moves the tab.
 */
export const ScheduleDetailsView = memo(function ScheduleDetailsViewImpl({ scheduleId }: ScheduleDetailsViewProps) {
  return (
    // `PageLayout`'s own two boxes, with its own `gap-l` between the page's
    // sections — composing `TitleBlock` by hand changes which parts wait for
    // data, never the spacing.
    <div className="flex w-full flex-col px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <Suspense fallback={<ScheduleHeaderSkeleton />}>
        <ScheduleHeader scheduleId={scheduleId} />
      </Suspense>

      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
        <Suspense fallback={<ScheduleInfoBarSkeleton />}>
          <ScheduleInfoBar scheduleId={scheduleId} />
        </Suspense>

        {/* The strip's own island — WHICH tabs exist is the schedule's answer
            (no Schedule Runs on an event-driven one). Its fallback is the same
            strip on the certain tabs, so the page keeps a working tab bar
            through the wait instead of a placeholder, and the bodies below go on
            loading under it. */}
        <Suspense fallback={<ScheduleTabs scheduleId={scheduleId} tabs={SCHEDULE_TABS_WITHOUT_RUNS} />}>
          <ScheduleTabsIsland scheduleId={scheduleId} />
        </Suspense>
      </div>
    </div>
  );
});
ScheduleDetailsView.displayName = 'ScheduleDetailsView';
