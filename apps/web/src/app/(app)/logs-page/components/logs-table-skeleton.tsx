'use client';

import { LogsTableSkeleton as LogsTableSkeletonView } from '@flamingo-stack/openframe-frontend-core/components/features';
import { DateColumnHeader } from '@/app/components/shared/date-column-header';

/**
 * Loading fallback for `LogsTable`: the lib's logs table skeleton with this
 * app's date header in its inert form (no `filter`), so the calendar icon does
 * not arrive with the data and shove the label sideways.
 *
 * Lives in its own module (rather than inside `logs-table.tsx`) because it is
 * reused as a loading state by consumers that must NOT pull in the Relay
 * queries and generated artifacts of the real table: the device-details
 * skeleton and the route-level logs skeleton.
 */
const INERT_LOG_ID_HEADER = <DateColumnHeader label="Log ID" />;

export function LogsTableSkeleton() {
  return <LogsTableSkeletonView logIdHeader={INERT_LOG_ID_HEADER} />;
}
