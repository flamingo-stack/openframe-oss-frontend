'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import { memo, Suspense } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scriptScheduleDetailRelayQuery as ScheduleDetailQueryType } from '@/__generated__/scriptScheduleDetailRelayQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { scriptScheduleDetailRelayQuery } from '@/graphql/scripts/script-schedule-detail-relay';
import { customParamsByScriptId } from '../utils/schedule-script-params';
import { ScheduleScriptCard } from './schedule-script-card';

/** The list of script cards, loaded and loading alike. */
const SCRIPT_LIST_CLASS = 'flex flex-col gap-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]';

/**
 * The part that reads the schedule, and therefore the part that suspends.
 *
 * `store-or-network`: the page's header and timing-bar islands revalidated this
 * exact query on load, so this one reads the store instead of refetching the
 * whole schedule every time the user comes back to this tab.
 */
function ScheduleScriptsTabContent({ scheduleId }: { scheduleId: string }) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<ScheduleDetailQueryType>(
    scriptScheduleDetailRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );
  const schedule = data.scriptSchedule;

  // Not-found is reported once, by the timing bar above; render nothing here.
  if (!schedule) {
    return null;
  }

  if (schedule.scripts.length === 0) {
    return (
      <div className="pt-[var(--spacing-system-l)] text-ods-text-secondary text-h6">
        No scripts in this schedule yet.
      </div>
    );
  }

  // Per-script overrides, keyed the way the schema keys them — by script, not by
  // run position — so a schedule that runs the same script twice hands both
  // cards the same one. There is no per-entry override to hand them instead.
  const customParams = customParamsByScriptId(schedule.scriptCustomParams);

  return (
    <div className={SCRIPT_LIST_CLASS}>
      {schedule.scripts.map((script, position) => (
        // A schedule may run the same script more than once ("A, B, A" is a
        // valid recipe), so `script.id` is NOT unique here — the RUN POSITION is
        // what identifies an entry. The list is read-only and ordered by the
        // server, so position is stable for as long as the data is.
        <ScheduleScriptCard
          key={`${script.id}-${position}`}
          script={script}
          customParams={customParams.get(script.id)}
        />
      ))}
    </div>
  );
}

/**
 * How many cards the loading tab draws. ONE: a schedule that runs nothing is not
 * a schedule, so the first card is the only one certain to be there; a second
 * would promise an entry most schedules do not have and then collapse.
 */
const SCHEDULE_SCRIPTS_SKELETON_COUNT = 1;

/** The tab before its schedule: the same list, its cards drawing their own skeletons in the loading scope. */
function ScheduleScriptsTabLoading() {
  return (
    <div className={SCRIPT_LIST_CLASS}>
      {Array.from({ length: SCHEDULE_SCRIPTS_SKELETON_COUNT }, (_, i) => (
        <ScheduleScriptCard key={i} />
      ))}
    </div>
  );
}

/**
 * "Scheduled Scripts" tab — the recipe the schedule runs, in order.
 *
 * Carries its own boundary: a tab that suspends is the tab's business, not the
 * page's, so switching to it draws the tab's loading state and leaves the header, the
 * timing bar and the tab strip untouched.
 *
 * `memo` for the reason given in `schedule-detail-tabs.ts`.
 */
export const ScheduleScriptsTab = memo(function ScheduleScriptsTabImpl({ scheduleId }: { scheduleId: string }) {
  return (
    <Suspense
      fallback={
        <LoadingFallback label="Loading scripts">
          <ScheduleScriptsTabLoading />
        </LoadingFallback>
      }
    >
      <ScheduleScriptsTabContent scheduleId={scheduleId} />
    </Suspense>
  );
});
ScheduleScriptsTab.displayName = 'ScheduleScriptsTab';
