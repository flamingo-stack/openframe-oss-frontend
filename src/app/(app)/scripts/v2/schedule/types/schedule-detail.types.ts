import type { scriptScheduleDetailRelayQuery as ScheduleDetailQueryType } from '@/__generated__/scriptScheduleDetailRelayQuery.graphql';

/**
 * The loaded `scriptSchedule` payload of the schedule detail query — the shape
 * every schedule page (details, edit, devices) works with once its query
 * resolves. Derived from the query artifact rather than hand-written, so a
 * schema change surfaces at the call sites instead of drifting silently.
 */
export type ScheduleDetailData = NonNullable<ScheduleDetailQueryType['response']['scriptSchedule']>;

/** One entry of a schedule's script list, with the args/env it runs under. */
export type ScheduleScript = ScheduleDetailData['scripts'][number];
