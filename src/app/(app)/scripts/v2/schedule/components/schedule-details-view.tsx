'use client';

import { NotFoundError, Tag, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import {
  BoxArchiveIcon,
  InboxArrowUpIcon,
  LaptopIcon,
  PenEditIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, TabNavigation } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { memo, Suspense, useCallback, useMemo, useState } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scriptScheduleDetailRelayQuery as ScheduleDetailQueryType } from '@/__generated__/scriptScheduleDetailRelayQuery.graphql';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { scriptScheduleDetailRelayQuery } from '@/graphql/scripts/script-schedule-detail-relay';
import { decodeGlobalId } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { CONTEXT_ENTITY_KIND } from '../../../../mingo/context/context-types';
import { useTrackOpenView } from '../../../../mingo/context/use-track-open-view';
import { ScheduleInfoBarFromData } from '../../../components/schedule/schedule-info-bar';
import { initiatorName } from '../../shared/utils/execution-helpers';
import { platformsToIds } from '../../shared/utils/script-mappers';
import { useScheduleArchive } from '../hooks/use-schedule-archive';
import { formatScheduleStartAt, repeatToLabel } from '../utils/schedule-timing';
import { ArchiveScheduleModal } from './archive-schedule-modal';
import { SCHEDULE_DEFAULT_TAB, SCHEDULE_DETAIL_TABS, scheduleTabBody } from './schedule-detail-tabs';
import { ScheduleHeaderSkeleton } from './schedule-details-skeleton';
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
  const data = useLazyLoadQuery<ScheduleDetailQueryType>(
    scriptScheduleDetailRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-and-network' },
  );
  const schedule = data.scriptSchedule;

  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const { isArchived, isArchiving, isPending, toggleArchive } = useScheduleArchive(schedule);

  // Back follows the list the schedule actually belongs to, so Back from an
  // archived schedule doesn't land the user on a list without it.
  const handleBack = useSafeBack(isArchived ? routes.scriptsV2.schedules.archived : routes.scriptsV2.schedules.list);

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
            href: routes.scriptsV2.schedules.devices(scheduleId),
            icon: <LaptopIcon className="text-ods-text-secondary" />,
          },
          {
            label: 'Edit Schedule',
            variant: 'outline' as const,
            href: routes.scriptsV2.schedules.edit(scheduleId),
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
  const data = useLazyLoadQuery<ScheduleDetailQueryType>(
    scriptScheduleDetailRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-and-network' },
  );
  const schedule = data.scriptSchedule;

  if (!schedule) {
    return <NotFoundError message="Schedule not found" />;
  }

  const { date, time } = formatScheduleStartAt(schedule.startAt);

  // No name / note row: the page title carries them (design node 260:44649).
  return (
    <ScheduleInfoBarFromData
      date={date}
      time={time}
      repeat={repeatToLabel(schedule.repeat)}
      platforms={platformsToIds(schedule.supportedPlatforms)}
      trigger={schedule.trigger}
      addedBy={initiatorName(schedule.author)}
    />
  );
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
export const ScheduleDetailsView = memo(function ScheduleDetailsView({ scheduleId }: ScheduleDetailsViewProps) {
  return (
    // `PageLayout`'s own two boxes, with its own `gap-l` between the page's
    // sections — composing `TitleBlock` by hand changes which parts wait for
    // data, never the spacing.
    <div className="flex flex-col w-full px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <Suspense fallback={<ScheduleHeaderSkeleton />}>
        <ScheduleHeader scheduleId={scheduleId} />
      </Suspense>

      <div className="flex flex-col flex-1 gap-[var(--spacing-system-l)]">
        <Suspense fallback={<ScheduleInfoBarSkeleton />}>
          <ScheduleInfoBar scheduleId={scheduleId} />
        </Suspense>

        {/* `TabNavigation` renders as a fragment, so its bar and its body are
            siblings — left as direct children of the column above they would be
            pushed apart by its `gap`. Grouped here into ONE flex item instead:
            the bar sits flush on the body, and each tab body owns the top
            padding that separates it from the bar. */}
        <div className="flex flex-col">
          {/* Each tab brings its own body, its own boundary and its own
              skeleton (see `schedule-detail-tabs.ts`) — this page renders
              whichever one the strip is on and knows nothing else about them. */}
          <TabNavigation tabs={SCHEDULE_DETAIL_TABS} urlSync defaultTab={SCHEDULE_DEFAULT_TAB}>
            {activeTab => {
              const TabBody = scheduleTabBody(activeTab);
              return <TabBody scheduleId={scheduleId} />;
            }}
          </TabNavigation>
        </div>
      </div>
    </div>
  );
});
