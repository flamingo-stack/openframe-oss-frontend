import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the Incidents table. Data-only on purpose (see
 * `table-column-layout.ts`): read by the live table AND its Suspense fallback,
 * so the loading header reserves the same widths as the loaded one.
 *
 * The record is the declaration; the array below fixes the render ORDER. The
 * ids double as the TanStack column ids the server-side filters key on: the
 * Incident column filters by `type`, the Device column by customer, the
 * Assigned column by assignee.
 */
export const INCIDENT_COLUMNS = {
  incident: { id: 'type', header: 'Incident', width: 'flex-1 min-w-0', filterable: true },
  device: { id: 'organizationId', header: 'Device', width: 'flex-1 min-w-0', hideAt: 'md', filterable: true },
  severity: { id: 'severity', header: 'Severity', width: 'w-[96px] content-md:w-[120px]', filterable: true },
  status: { id: 'status', header: 'Status', width: 'w-[150px]', hideAt: 'lg', filterable: true },
  assignee: { id: 'assigneeId', header: 'Assigned', width: 'w-[200px]', hideAt: 'lg', filterable: true },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  mingo: { id: 'mingo', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export const INCIDENTS_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  INCIDENT_COLUMNS.incident,
  INCIDENT_COLUMNS.device,
  INCIDENT_COLUMNS.severity,
  INCIDENT_COLUMNS.status,
  INCIDENT_COLUMNS.assignee,
  INCIDENT_COLUMNS.actions,
  INCIDENT_COLUMNS.mingo,
  INCIDENT_COLUMNS.open,
];

/** The device page's Incidents tab: one device, so no Device column. */
export const DEVICE_INCIDENTS_TABLE_COLUMNS: readonly TableSkeletonColumn[] = INCIDENTS_TABLE_COLUMNS.filter(
  column => column !== INCIDENT_COLUMNS.device,
);

/** A single-status tab (Snoozed, Archived): every row has the same status, so Status offers no filter. */
const LOCKED_STATUS_COLUMN: TableSkeletonColumn = { ...INCIDENT_COLUMNS.status, filterable: false };
export const LOCKED_STATUS_INCIDENTS_TABLE_COLUMNS: readonly TableSkeletonColumn[] = INCIDENTS_TABLE_COLUMNS.map(
  column => (column === INCIDENT_COLUMNS.status ? LOCKED_STATUS_COLUMN : column),
);
