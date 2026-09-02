'use client';

import { type DeviceType, getDeviceTypeIcon } from '@flamingo-stack/openframe-frontend-core';
import { OSTypeBadge } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  ArrowRightUpIcon,
  BracketCurlyEllipsisVrIcon,
  MonitorIcon,
  XmarkCircleIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  EntityImage,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useMemo, useState } from 'react';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { usePolicyDevicesTable } from '../hooks/use-policy-devices-table';
import type { PolicyDeviceRow } from '../types/policy-device-row';
import { QuickQueryPanel } from './quick-query-panel';

interface PolicyDevicesTableProps {
  policyId: number;
  assignedHostIds?: Array<{ id: number; hostname: string }>;
  /** Policy osquery SQL — copied into the per-device Quick Query draft. */
  policyQuery?: string;
}

export function PolicyDevicesTable({ policyId, assignedHostIds, policyQuery }: PolicyDevicesTableProps) {
  const { rows, isLoading } = usePolicyDevicesTable(policyId, assignedHostIds);

  const [quickQueryIds, setQuickQueryIds] = useState<Set<string>>(new Set());

  const hasQuery = Boolean(policyQuery?.trim());

  const toggleQuickQuery = useCallback((rowId: string) => {
    setQuickQueryIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const columns = useMemo<ColumnDef<PolicyDeviceRow>[]>(
    () => [
      {
        id: 'device',
        accessorKey: 'displayName',
        header: 'DEVICE',
        cell: ({ row }: { row: Row<PolicyDeviceRow> }) => {
          const r = row.original;
          return (
            <div className="relative box-border flex h-20 w-full shrink-0 content-stretch items-center justify-start gap-4 py-0">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-ods-border">
                {r.deviceType &&
                  getDeviceTypeIcon(r.deviceType.toLowerCase() as DeviceType, {
                    className: 'w-5 h-5 text-ods-text-secondary',
                  })}
              </div>
              <div className="min-w-0 flex-1">
                <TruncateText>{r.displayName || r.hostname}</TruncateText>
              </div>
            </div>
          );
        },
        meta: { width: 'flex-1 md:w-1/3' },
      },
      {
        id: 'organization',
        accessorKey: 'organization',
        header: 'CUSTOMER',
        cell: ({ row }: { row: Row<PolicyDeviceRow> }) => {
          const r = row.original;
          const fullImageUrl = getFullImageUrl(r.organizationImageUrl, r.organizationImageHash);
          return (
            <div className="flex items-center gap-3">
              <EntityImage src={fullImageUrl} alt={r.organization || 'Customer'} className="size-12 md:size-12" />
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <span className="break-words text-ods-text-primary text-h4">{r.organization || ''}</span>
              </div>
            </div>
          );
        },
        meta: { width: 'w-1/6', hideAt: 'lg' as const },
      },
      {
        id: 'os',
        accessorKey: 'osType',
        header: 'OS',
        cell: ({ row }: { row: Row<PolicyDeviceRow> }) => (
          <div className="flex shrink-0 items-start gap-2">
            <OSTypeBadge osType={row.original.osType} />
          </div>
        ),
        meta: { width: 'w-[120px] md:w-1/6', hideAt: 'md' as const },
      },
      {
        id: 'compliance',
        accessorKey: 'complianceStatus',
        header: 'STATUS',
        cell: ({ row }: { row: Row<PolicyDeviceRow> }) => {
          const r = row.original;
          if (r.complianceStatus === 'pending') return <Tag label="Pending" variant="warning" />;
          return (
            <Tag
              label={r.complianceStatus === 'non-compliant' ? 'Non-Compliant' : 'Passing'}
              variant={r.complianceStatus === 'non-compliant' ? 'error' : 'success'}
            />
          );
        },
        meta: { width: 'w-[140px]' },
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<PolicyDeviceRow> }) =>
          row.original.machineId ? (
            <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
              <Button
                onClick={openInNewTab(routes.devices.details(row.original.machineId))}
                variant="outline"
                size="icon"
                leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
                aria-label="Open in new tab"
                className="bg-ods-card"
              />
            </div>
          ) : null,
        enableSorting: false,
        meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
      },
      {
        id: 'quick-query',
        cell: ({ row }: { row: Row<PolicyDeviceRow> }) => {
          const isOpen = quickQueryIds.has(String(row.original.id));
          return (
            <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
              <Button
                onClick={() => toggleQuickQuery(String(row.original.id))}
                variant="outline"
                disabled={!isOpen && !hasQuery}
                leftIcon={
                  isOpen ? <XmarkCircleIcon className="h-5 w-5" /> : <BracketCurlyEllipsisVrIcon className="h-5 w-5" />
                }
                aria-label={isOpen ? 'Close quick query' : 'Open quick query'}
                aria-expanded={isOpen}
                className="w-full bg-ods-card"
              >
                {/* Icon-only on mobile, per design. */}
                <span className="hidden md:inline">{isOpen ? 'Close' : 'Quick Query'}</span>
              </Button>
            </div>
          );
        },
        enableSorting: false,
        // Fixed column width (matching the header's empty cell) so the flex
        // columns before it stretch identically in the header and the rows;
        // the w-full button inside also keeps Quick Query / Close equal width.
        meta: { width: 'w-12 md:w-[160px] shrink-0 flex-none', align: 'right' },
      },
    ],
    [quickQueryIds, toggleQuickQuery, hasQuery],
  );

  const table = useDataTable<PolicyDeviceRow>({
    data: rows,
    columns,
    getRowId: (row: PolicyDeviceRow) => String(row.id),
    enableSorting: false,
  });

  const policyDeviceRowHref = useCallback(
    (row: PolicyDeviceRow) => (row.machineId ? routes.devices.details(row.machineId) : undefined),
    [],
  );

  // The panel mounts on open and unmounts on close, so each open copies the
  // current policy query into a fresh draft and drops any previous run state.
  const renderSubRow = useCallback(
    (row: PolicyDeviceRow) => {
      if (!quickQueryIds.has(String(row.id))) return null;
      return <QuickQueryPanel fleetHostId={row.fleetHostId} initialQuery={policyQuery ?? ''} />;
    },
    [quickQueryIds, policyQuery],
  );

  // Per the design, the empty state replaces the whole table - headers hidden.
  const showHeader = isLoading || rows.length > 0;

  return (
    <DataTable table={table}>
      {showHeader && <DataTable.Header rightSlot={<DataTable.RowCount />} />}
      <DataTable.Body
        loading={isLoading}
        skeletonRows={5}
        emptyState={{
          icon: <MonitorIcon />,
          title: 'No devices assigned',
          description: 'Add devices to this policy to start enforcing it',
        }}
        rowHref={policyDeviceRowHref}
        renderSubRow={renderSubRow}
      />
    </DataTable>
  );
}
