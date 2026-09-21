import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the Incidents table. Data-only on purpose (see
 * `table-column-layout.ts`): read by the live table AND its Suspense fallback,
 * so the loading header reserves the same widths as the loaded one.
 *
 * The record is the declaration; the array below fixes the render ORDER. The
 * ids double as the TanStack column ids the server-side filters key on: the
 * Incident column filters by `type`, the Device column by customer.
 */
export const INCIDENT_COLUMNS = {
  incident: { id: 'type', header: 'Incident', width: 'flex-1 min-w-0', filterable: true },
  device: { id: 'organizationId', header: 'Device', width: 'flex-1 min-w-0', hideAt: 'md', filterable: true },
  severity: { id: 'severity', header: 'Severity', width: 'w-[96px] md:w-[120px]', filterable: true },
  status: { id: 'status', header: 'Status', width: 'w-[150px]', hideAt: 'lg', filterable: true },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  mingo: { id: 'mingo', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export const INCIDENTS_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  INCIDENT_COLUMNS.incident,
  INCIDENT_COLUMNS.device,
  INCIDENT_COLUMNS.severity,
  INCIDENT_COLUMNS.status,
  INCIDENT_COLUMNS.actions,
  INCIDENT_COLUMNS.mingo,
  INCIDENT_COLUMNS.open,
];
