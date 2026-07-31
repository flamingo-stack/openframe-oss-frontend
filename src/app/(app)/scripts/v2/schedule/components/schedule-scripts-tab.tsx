'use client';

import { memo, Suspense } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scriptScheduleDetailRelayQuery as ScheduleDetailQueryType } from '@/__generated__/scriptScheduleDetailRelayQuery.graphql';
import { scriptScheduleDetailRelayQuery } from '@/graphql/scripts/script-schedule-detail-relay';
import { ScheduleScriptCard, ScheduleScriptCardSkeleton } from './schedule-script-card';

/**
 * The part that reads the schedule, and therefore the part that suspends.
 *
 * `store-or-network`: the page's header and timing-bar islands revalidated this
 * exact query on load, so this one reads the store instead of refetching the
 * whole schedule every time the user comes back to this tab.
 */
function ScheduleScriptsTabContent({ scheduleId }: { scheduleId: string }) {
  const data = useLazyLoadQuery<ScheduleDetailQueryType>(
    scriptScheduleDetailRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-or-network' },
  );
  const schedule = data.scriptSchedule;

  // Not-found is reported once, by the timing bar above; render nothing here.
  if (!schedule) {
    return null;
  }

  if (schedule.scripts.length === 0) {
    return (
      <div className="pt-[var(--spacing-system-l)] text-h6 text-ods-text-secondary">
        No scripts in this schedule yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]">
      {schedule.scripts.map((script, position) => (
        // A schedule may run the same script more than once ("A, B, A" is a
        // valid recipe), so `script.id` is NOT unique here — the RUN POSITION is
        // what identifies an entry. The list is read-only and ordered by the
        // server, so position is stable for as long as the data is.
        <ScheduleScriptCard key={`${script.id}-${position}`} script={script} />
      ))}
    </div>
  );
}

export function ScheduleScriptsTabSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]">
      {['a', 'b'].map(key => (
        <ScheduleScriptCardSkeleton key={key} />
      ))}
    </div>
  );
}

/**
 * "Scheduled Scripts" tab — the recipe the schedule runs, in order.
 *
 * Carries its own boundary: a tab that suspends is the tab's business, not the
 * page's, so switching to it draws this skeleton and leaves the header, the
 * timing bar and the tab strip untouched.
 *
 * `memo` for the reason given in `schedule-detail-tabs.ts`.
 */
export const ScheduleScriptsTab = memo(function ScheduleScriptsTab({ scheduleId }: { scheduleId: string }) {
  return (
    <Suspense fallback={<ScheduleScriptsTabSkeleton />}>
      <ScheduleScriptsTabContent scheduleId={scheduleId} />
    </Suspense>
  );
});
