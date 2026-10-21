import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout of the remote sessions tables: the device's Remote Sessions tab and the tenant-wide sessions list
 * share it. A column set with one table lives beside that table.
 *
 * Data-only on purpose (see `table-column-layout.ts`): the live table reads it, and while the sessions are read the
 * same table draws its own loading state, so loading and loaded share one header by construction.
 */

/**
 * Remote Sessions tab (Figma 744-40363, mobile 758-46869): three equal content
 * columns plus one actions cell holding both the delete and the open button -
 * a single column so its header can carry the results count the mockup shows
 * above the buttons. On mobile the row is date + actions only.
 */
const REMOTE_SESSION_COLUMNS = {
  session: { id: 'session', header: 'SESSION', width: 'flex-1 min-w-0', dateFilterable: true },
  employee: { id: 'employee', header: 'EMPLOYEE', width: 'flex-1 min-w-0', hideAt: 'md', filterable: true },
  duration: { id: 'duration', header: 'DURATION', width: 'flex-1 min-w-0', hideAt: 'md', sortable: true },
  expires: { id: 'expires', header: 'RECORDING EXPIRES', width: 'flex-1 min-w-0', hideAt: 'md', filterable: true },
  actions: { id: 'actions', width: 'w-[112px] shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { REMOTE_SESSION_COLUMNS };
