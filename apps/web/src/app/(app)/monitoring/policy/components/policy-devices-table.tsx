'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  DeviceTypeTile,
  GRID_ACTION_BUTTON_CLASS,
  OSTypeBadge,
  renderDeviceTypeIcon,
} from '@flamingo-stack/openframe-frontend-core/components/features';
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
  GRID_ACTION_COLUMN_SIZE,
  GRID_MIN_WIDTH,
  LoadingWhen,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useMemo, useState } from 'react';
import { NO_ITEMS } from '@/app/components/shared';
import { loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { type TableLayout, tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import {
  MONITORING_DEVICE_GRID_SIZES,
  MONITORING_DEVICES_SKELETON_ROWS,
  POLICY_DEVICE_COLUMNS,
} from '../../components/monitoring-table-columns';
import { POLICY_DEVICES_TABLE_SETTINGS } from '../../components/monitoring-table-settings';
import { usePolicyDevicesTable } from '../hooks/use-policy-devices-table';
import type { PolicyDeviceRow } from '../types/policy-device-row';
import { QuickQueryPanel } from './quick-query-panel';

interface PolicyDevicesTableProps {
  policyId: number;
  assignedHostIds?: Array<{ id: number; hostname: string }>;
  /** Policy osquery SQL — copied into the per-device Quick Query draft. */
  policyQuery?: string;
}

/**
 * The policy's devices, as the table the `data-table-grid` flag picks. Until the flag answers the table is in a
 * loading scope: it reads nothing and draws loading rows.
 */
export function PolicyDevicesTable(props: PolicyDevicesTableProps) {
  const tableGate = useTableGridGate();
  return (
    <LoadingWhen loading={tableGate === 'loading'}>
      <PolicyDevicesTableReader {...props} tableLayout={tableLayoutFor(tableGate)} />
    </LoadingWhen>
  );
}

interface PolicyDevicesTableReaderProps extends PolicyDevicesTableProps {
  tableLayout: TableLayout;
}

/**
 * In a loading scope (the policy itself still loading, or the table's flag) it reads nothing and draws the table's
 * own loading rows; otherwise it reads the devices and draws them.
 */
function PolicyDevicesTableReader(props: PolicyDevicesTableReaderProps) {
  if (useLoadingScope()) {
    return (
      <PolicyDevicesTableView
        rows={NO_ITEMS}
        isLoading
        policyQuery={props.policyQuery}
        tableLayout={props.tableLayout}
      />
    );
  }
  return <PolicyDevicesTableContent {...props} />;
}

function PolicyDevicesTableContent({
  policyId,
  assignedHostIds,
  policyQuery,
  tableLayout,
}: PolicyDevicesTableReaderProps) {
  const { rows, isLoading } = usePolicyDevicesTable(policyId, assignedHostIds);
  return (
    <PolicyDevicesTableView rows={rows} isLoading={isLoading} policyQuery={policyQuery} tableLayout={tableLayout} />
  );
}

interface PolicyDevicesTableViewProps {
  rows: PolicyDeviceRow[];
  isLoading: boolean;
  policyQuery?: string;
  tableLayout: TableLayout;
}

function PolicyDevicesTableView({ rows, isLoading, policyQuery, tableLayout }: PolicyDevicesTableViewProps) {
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
        id: POLICY_DEVICE_COLUMNS.device.id,
        accessorKey: 'name',
        header: POLICY_DEVICE_COLUMNS.device.header,
        cell: ({ row }: { row: Row<PolicyDeviceRow> }) => {
          const r = row.original;
          return (
            <div className="relative box-border flex h-20 w-full shrink-0 content-stretch items-center justify-start gap-4 py-0">
              <DeviceTypeTile type={r.deviceType} />
              <div className="min-w-0 flex-1">
                <TruncateText>{r.name}</TruncateText>
              </div>
            </div>
          );
        },
        size: MONITORING_DEVICE_GRID_SIZES.device,
        minSize: GRID_MIN_WIDTH.icon,
        meta: liveColumnMeta(POLICY_DEVICE_COLUMNS.device, {
          label: 'Device',
          gridCell: ({ row }: { row: Row<PolicyDeviceRow> }) => (
            <DeviceNameGridCell name={row.original.name} deviceType={row.original.deviceType} />
          ),
        }),
      },
      {
        id: POLICY_DEVICE_COLUMNS.organization.id,
        accessorKey: 'organization',
        header: POLICY_DEVICE_COLUMNS.organization.header,
        cell: ({ row }: { row: Row<PolicyDeviceRow> }) => (
          <DeviceCustomerCell
            organization={row.original.organization}
            imageUrl={row.original.organizationImageUrl}
            imageHash={row.original.organizationImageHash}
          />
        ),
        size: MONITORING_DEVICE_GRID_SIZES.organization,
        minSize: GRID_MIN_WIDTH.media,
        meta: liveColumnMeta(POLICY_DEVICE_COLUMNS.organization, {
          label: 'Customer',
          gridCell: ({ row }: { row: Row<PolicyDeviceRow> }) => (
            <DeviceCustomerGridCell
              organization={row.original.organization}
              imageUrl={row.original.organizationImageUrl}
              imageHash={row.original.organizationImageHash}
            />
          ),
        }),
      },
      {
        id: POLICY_DEVICE_COLUMNS.os.id,
        accessorKey: 'osType',
        header: POLICY_DEVICE_COLUMNS.os.header,
        cell: ({ row }: { row: Row<PolicyDeviceRow> }) => (
          <div className="flex shrink-0 items-start gap-2">
            <OSTypeBadge osType={row.original.osType} />
          </div>
        ),
        size: MONITORING_DEVICE_GRID_SIZES.os,
        minSize: GRID_MIN_WIDTH.icon,
        meta: liveColumnMeta(POLICY_DEVICE_COLUMNS.os, {
          label: 'OS',
          gridCell: ({ row }: { row: Row<PolicyDeviceRow> }) => <DeviceOsGridCell osType={row.original.osType} />,
        }),
      },
      {
        id: POLICY_DEVICE_COLUMNS.compliance.id,
        accessorKey: 'complianceStatus',
        header: POLICY_DEVICE_COLUMNS.compliance.header,
        cell: ({ row }: { row: Row<PolicyDeviceRow> }) => <ComplianceCell status={row.original.complianceStatus} />,
        size: MONITORING_DEVICE_GRID_SIZES.status,
        meta: liveColumnMeta(POLICY_DEVICE_COLUMNS.compliance, { label: 'Status' }),
      },
      {
        id: POLICY_DEVICE_COLUMNS.open.id,
        cell: ({ row }: { row: Row<PolicyDeviceRow> }) => <DeviceOpenCell machineId={row.original.machineId} />,
        enableSorting: false,
        size: GRID_ACTION_COLUMN_SIZE,
        meta: liveColumnMeta(POLICY_DEVICE_COLUMNS.open, {
          gridKind: 'action',
          gridCell: ({ row }: { row: Row<PolicyDeviceRow> }) => (
            <DeviceOpenCell machineId={row.original.machineId} grid />
          ),
        }),
      },
      {
        id: POLICY_DEVICE_COLUMNS.quickQuery.id,
        cell: ({ row }: { row: Row<PolicyDeviceRow> }) => (
          <QuickQueryToggle
            isOpen={quickQueryIds.has(String(row.original.id))}
            hasQuery={hasQuery}
            onToggle={() => toggleQuickQuery(String(row.original.id))}
          />
        ),
        enableSorting: false,
        size: GRID_ACTION_COLUMN_SIZE,
        // Fixed column width (matching the header's empty cell) so the flex
        // columns before it stretch identically in the header and the rows;
        // the w-full button inside also keeps Quick Query / Close equal width.
        meta: liveColumnMeta(POLICY_DEVICE_COLUMNS.quickQuery, {
          gridKind: 'action',
          gridCell: ({ row }: { row: Row<PolicyDeviceRow> }) => (
            <QuickQueryToggle
              isOpen={quickQueryIds.has(String(row.original.id))}
              hasQuery={hasQuery}
              onToggle={() => toggleQuickQuery(String(row.original.id))}
              grid
            />
          ),
        }),
      },
    ],
    [quickQueryIds, toggleQuickQuery, hasQuery],
  );

  // While loading the table holds one typical list of placeholder rows, drawn with the real cells (`loadingCells`):
  // every part of a row draws its own loading form, so a loading row is the loaded row's own layout.
  const loadingRows = useMemo(
    () => (isLoading ? loadingPlaceholderRows<PolicyDeviceRow>(MONITORING_DEVICES_SKELETON_ROWS) : null),
    [isLoading],
  );

  const table = useDataTable<PolicyDeviceRow>({
    data: loadingRows ?? rows,
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
      return <QuickQueryPanel fleetHostId={row.fleetHostId} deviceName={row.name} initialQuery={policyQuery ?? ''} />;
    },
    [quickQueryIds, policyQuery],
  );

  // Per the design, the empty state replaces the whole table - headers hidden.
  const showHeader = isLoading || rows.length > 0;

  const grid = tableLayout === 'grid';

  return (
    // No height of its own: the table is a section of the policy's page, which scrolls.
    <DataTable table={table} layout={tableLayout} settings={grid ? POLICY_DEVICES_TABLE_SETTINGS : undefined}>
      {/* The grid's results count sits above the table; the card header carries its own (`rightSlot`). */}
      {showHeader && grid && (
        <DataTable.Meta>
          <DataTable.RowCount loading={isLoading} />
        </DataTable.Meta>
      )}
      {showHeader && <DataTable.Header rightSlot={<DataTable.RowCount loading={isLoading} />} loading={isLoading} />}
      <DataTable.Body
        loading={isLoading}
        loadingCells={isLoading}
        skeletonRows={MONITORING_DEVICES_SKELETON_ROWS}
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

/** A device's customer: its logo over the name beside it. Each part draws its own loading form while the row is read. */
export function DeviceCustomerCell({
  organization,
  imageUrl,
  imageHash,
}: {
  organization: string | null | undefined;
  imageUrl: string | null | undefined;
  imageHash: string | null | undefined;
}) {
  const loading = useLoadingScope();
  return (
    <div className="flex items-center gap-3">
      <EntityImage
        src={getFullImageUrl(imageUrl, imageHash)}
        alt={organization || 'Customer'}
        className="size-12 content-md:size-12"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {loading && !organization ? (
          <TextLineSkeleton type="h4" className="w-3/4" />
        ) : (
          <span className="break-words text-ods-text-primary text-h4">{organization || ''}</span>
        )}
      </div>
    </div>
  );
}

/* ───────────── grid-table cells: one 48px line each (the card cells above stay for the cards table) ───────────── */

/** The device's type icon and its name, with a short text after it (when it was last online). */
export function DeviceNameGridCell({
  name,
  deviceType,
  secondary,
}: {
  name: string | undefined;
  deviceType: string | null | undefined;
  secondary?: string;
}) {
  return (
    <DataTable.Cell
      leading={{
        type: 'icon',
        icon: renderDeviceTypeIcon(deviceType ?? undefined, 'size-5') ?? <MonitorIcon className="size-5" />,
      }}
      text={name ?? ''}
      secondary={secondary}
    />
  );
}

/** A device's customer: its logo and its name on one line. */
export function DeviceCustomerGridCell({
  organization,
  imageUrl,
  imageHash,
}: {
  organization: string | null | undefined;
  imageUrl: string | null | undefined;
  imageHash: string | null | undefined;
}) {
  return (
    <DataTable.Cell
      leading={{ type: 'image', src: getFullImageUrl(imageUrl, imageHash), alt: organization || 'Customer' }}
      text={organization ?? ''}
    />
  );
}

/** The device's OS: its mark and its name, the name cut when the column is narrow. */
export function DeviceOsGridCell({ osType }: { osType: string | null | undefined }) {
  return <OSTypeBadge osType={osType ?? undefined} iconSize="w-5 h-5" className="min-w-0 truncate" />;
}

/**
 * Opens the device's page in a new tab. Static chrome: drawn real while the row is read, and inert. `grid` is the grid
 * table's form: a bare 40px icon button, the action cell being its frame.
 */
export function DeviceOpenCell({ machineId, grid = false }: { machineId: string | null | undefined; grid?: boolean }) {
  const loading = useLoadingScope();
  if (!loading && !machineId) return null;
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading || !machineId ? undefined : openInNewTab(routes.devices.details(machineId))}
        variant={grid ? 'transparent' : 'outline'}
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label="Open in new tab"
        className={grid ? GRID_ACTION_BUTTON_CLASS : 'bg-ods-card'}
        disabled={loading}
      />
    </div>
  );
}

/**
 * The row's Quick Query / Close toggle. Static chrome: drawn real while the row is read, and inert. `grid` is the grid
 * table's form: the icon alone in a 56px action column, named by its `aria-label` (a card row prints the label from
 * `md` up).
 */
export function QuickQueryToggle({
  isOpen,
  hasQuery,
  onToggle,
  grid = false,
}: {
  isOpen: boolean;
  hasQuery: boolean;
  onToggle: () => void;
  grid?: boolean;
}) {
  const loading = useLoadingScope();
  const icon = isOpen ? <XmarkCircleIcon className="h-5 w-5" /> : <BracketCurlyEllipsisVrIcon className="h-5 w-5" />;
  const label = isOpen ? 'Close quick query' : 'Open quick query';
  const disabled = loading || (!isOpen && !hasQuery);
  if (grid) {
    return (
      <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
        <Button
          onClick={onToggle}
          variant="transparent"
          size="icon"
          disabled={disabled}
          leftIcon={icon}
          aria-label={label}
          aria-expanded={isOpen}
          className={GRID_ACTION_BUTTON_CLASS}
        />
      </div>
    );
  }
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={onToggle}
        variant="outline"
        disabled={disabled}
        leftIcon={icon}
        aria-label={label}
        aria-expanded={isOpen}
        className="w-full bg-ods-card"
      >
        {/* Icon-only on mobile, per design. */}
        <span className="hidden content-md:inline">{isOpen ? 'Close' : 'Quick Query'}</span>
      </Button>
    </div>
  );
}

/** The device's compliance with this policy as its tag; the tag's own loading form while the row is read. */
function ComplianceCell({ status }: { status: PolicyDeviceRow['complianceStatus'] | undefined }) {
  const loading = useLoadingScope() && !status;
  if (status === 'pending') return <Tag label="Pending" variant="warning" />;
  return (
    <Tag
      label={status === 'non-compliant' ? 'Non-Compliant' : 'Passing'}
      variant={status === 'non-compliant' ? 'error' : 'success'}
      loading={loading}
    />
  );
}
