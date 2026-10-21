import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the Incidents table. Data-only on purpose (see
 * `table-column-layout.ts`): read by the live table AND its Suspense fallback,
 * so the loading header reserves the same widths as the loaded one.
 *
 * The ids double as the TanStack column ids the server-side filters key on: the
 * Incident column filters by `type`, the Device column by customer, the
 * Assigned column by assignee.
 */
export const INCIDENT_COLUMNS = {
  incident: { id: 'type', header: 'Incident', width: 'flex-1 min-w-0' },
  device: { id: 'organizationId', header: 'Device', width: 'flex-1 min-w-0', hideAt: 'md' },
  severity: { id: 'severity', header: 'Severity', width: 'w-[96px] content-md:w-[120px]' },
  status: { id: 'status', header: 'Status', width: 'w-[150px]', hideAt: 'lg' },
  assignee: { id: 'assigneeId', header: 'Assigned', width: 'w-[200px]', hideAt: 'lg' },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  mingo: { id: 'mingo', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;
