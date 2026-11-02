'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { MediaSkeleton, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  CodeIcon,
  GridIcon,
  PackageAltIcon,
  PackageIcon,
  Puzzle01Icon,
  WebDesignIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  type Row,
  SearchInput,
  type SortingState,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import { useQueryClient } from '@tanstack/react-query';
import { type ComponentType, useMemo, useState } from 'react';
import { LIVE_ROW_GAP_CLASS, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { ValueText } from '@/app/components/shared/value-text';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { toValidDate } from '@/lib/format-date';
import type { Device, Software } from '../../types/device.types';
import { fleetTimestampMs } from '../../utils/fleet-timestamp';
import { deviceQueryKeys } from '../../utils/query-keys';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';

/** Software tab over the Fleet host payload (`software-management` off). */
const FLEET_SOFTWARE_COLUMNS = {
  name: { id: 'name', header: 'SOFTWARE', width: 'flex-1 min-w-0' },
  source: { id: 'source', header: 'SOURCE', width: 'w-[180px] shrink-0', hideAt: 'lg' },
  vulnerabilities: { id: 'vulnerabilities', header: 'VULNERABILITIES', width: 'w-[160px] shrink-0' },
  filePath: { id: 'file_path', header: 'FILE PATH', width: 'w-[220px] shrink-0', hideAt: 'lg' },
  lastUsed: { id: 'last_opened_at', header: 'LAST USED', width: 'w-[140px] shrink-0', hideAt: 'md' },
} satisfies Record<string, TableSkeletonColumn>;

interface FleetSoftwareTabProps {
  device: Device | null;
}

const EMPTY_SOFTWARE: Software[] = [];
const EMPTY_COLUMN_FILTERS: never[] = [];

/** Software source → icons-v2 glyph + readable label for the SOURCE column. */
const SOURCE_ICON: Record<string, { Icon: ComponentType<{ className?: string }>; label: string }> = {
  apps: { Icon: GridIcon, label: 'Application' },
  chrome_extensions: { Icon: Puzzle01Icon, label: 'Chrome Extension' },
  vscode_extensions: { Icon: CodeIcon, label: 'VS Code Extension' },
  homebrew_packages: { Icon: PackageIcon, label: 'Homebrew Package' },
  python_packages: { Icon: PackageAltIcon, label: 'Python Package' },
};

function getSourceIcon(source: string): { Icon: ComponentType<{ className?: string }>; label: string } {
  return SOURCE_ICON[source] ?? { Icon: PackageIcon, label: source };
}

/** Fleet reports "never used" as the epoch, so a zero instant reads as empty too. */
function formatLastUsed(dateString?: string): string {
  const date = toValidDate(dateString);
  return date && date.getTime() > 0 ? formatRelativeTime(date) : EMPTY_VALUE;
}

/**
 * Rows the loading table holds (placeholder rows, drawn with their real cells): the list is read whole, so this is the
 * body's own default count (the lib's `DATA_TABLE_SKELETON_ROWS`), stated here so the rows and the body agree.
 */
const FLEET_SOFTWARE_SKELETON_ROWS = 10;

/** The title over its version; on a loading row both lines draw their bars (`TruncateText` with no text). */
function SoftwareNameCell({ name, version }: { name: string; version: string | undefined }) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText>{name}</TruncateText>
      {(loading || version) && (
        <TruncateText variant="h6" tone="secondary">
          {version ?? ''}
        </TruncateText>
      )}
    </div>
  );
}

/** Where the title came from, glyph and label; on a loading row the glyph is a bar of its size and the label a bar. */
function SourceCell({ source }: { source: string | undefined }) {
  const loading = useLoadingScope();
  // The source's glyph is a plain icon component (no loading form of its own): a bar of its size on a loading row.
  const { Icon: SourceGlyph, label } = getSourceIcon(source ?? '');
  return (
    <div className="inline-flex min-w-0 items-center gap-[var(--spacing-system-xs)] text-ods-text-secondary">
      {loading ? (
        <MediaSkeleton.Icon className="h-4 w-4 shrink-0 content-md:h-6 content-md:w-6" />
      ) : (
        <SourceGlyph className="h-4 w-4 shrink-0 content-md:h-6 content-md:w-6" />
      )}
      <div className="min-w-0">
        <TruncateText tone="secondary" loading={loading}>
          {label}
        </TruncateText>
      </div>
    </div>
  );
}

/** The title's issue count as a tag; the tag's own skeleton on a loading row (a placeholder has no count). */
function VulnerabilityCountCell({ count }: { count: number }) {
  if (useLoadingScope()) return <Tag label="" loading className="w-fit" />;
  if (count === 0) return <Tag label="NO ISSUES" variant="success" className="w-fit" />;
  return <Tag label={`${count} ${count === 1 ? 'ISSUE' : 'ISSUES'}`} variant="error" className="w-fit" />;
}

/** When the title was last opened; a bar of its line on a loading row. */
function LastUsedCell({ date }: { date: string | undefined }) {
  if (useLoadingScope()) return <TextLineSkeleton type="h6" className="w-3/4" />;
  return <div className="text-ods-text-primary text-h6">{formatLastUsed(date)}</div>;
}

/**
 * Device → Software over the Fleet host payload: the inventory the device query
 * already carries (`device.software`, mapped in `use-device-details.ts`), so the
 * tab costs no request of its own and searches and sorts client-side over the
 * whole list. What `SoftwareTab` draws while `software-management` is off; with
 * the module on it draws the module's table instead (`software-tab.tsx`).
 */
export function FleetSoftwareTab({ device }: FleetSoftwareTabProps) {
  const loading = useLoadingScope();
  const queryClient = useQueryClient();
  const allSoftware = device?.software || EMPTY_SOFTWARE;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const software = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return allSoftware;
    return allSoftware.filter(
      item => item.name.toLowerCase().includes(query) || (item.vendor ?? '').toLowerCase().includes(query),
    );
  }, [allSoftware, debouncedSearch]);

  const columns = useMemo<ColumnDef<Software>[]>(
    () => [
      {
        accessorKey: 'name',
        header: FLEET_SOFTWARE_COLUMNS.name.header,
        cell: ({ row }: { row: Row<Software> }) => (
          <SoftwareNameCell name={row.original.name} version={row.original.version} />
        ),
        enableSorting: true,
        meta: liveColumnMeta(FLEET_SOFTWARE_COLUMNS.name),
      },
      {
        accessorKey: 'source',
        header: FLEET_SOFTWARE_COLUMNS.source.header,
        cell: ({ row }: { row: Row<Software> }) => <SourceCell source={row.original.source} />,
        enableSorting: true,
        meta: liveColumnMeta(FLEET_SOFTWARE_COLUMNS.source),
      },
      {
        id: FLEET_SOFTWARE_COLUMNS.vulnerabilities.id,
        header: FLEET_SOFTWARE_COLUMNS.vulnerabilities.header,
        accessorFn: (row: Software) => row.vulnerabilities?.length ?? 0,
        cell: ({ row }: { row: Row<Software> }) => (
          <VulnerabilityCountCell count={row.original.vulnerabilities?.length ?? 0} />
        ),
        enableSorting: true,
        sortingFn: (rowA: Row<Software>, rowB: Row<Software>) => {
          const a = rowA.original.vulnerabilities.length;
          const b = rowB.original.vulnerabilities.length;
          if (a === b) return 0;
          return a > b ? 1 : -1;
        },
        meta: liveColumnMeta(FLEET_SOFTWARE_COLUMNS.vulnerabilities),
      },
      {
        id: FLEET_SOFTWARE_COLUMNS.filePath.id,
        header: FLEET_SOFTWARE_COLUMNS.filePath.header,
        accessorFn: (row: Software) => row.installed_paths?.[0] ?? '',
        cell: ({ row }: { row: Row<Software> }) => {
          const path = row.original.installed_paths?.[0];
          return path ? <TruncateText>{path}</TruncateText> : <ValueText value={null} />;
        },
        enableSorting: false,
        meta: liveColumnMeta(FLEET_SOFTWARE_COLUMNS.filePath),
      },
      {
        accessorKey: 'last_opened_at',
        header: FLEET_SOFTWARE_COLUMNS.lastUsed.header,
        cell: ({ row }: { row: Row<Software> }) => <LastUsedCell date={row.original.last_opened_at} />,
        enableSorting: true,
        meta: liveColumnMeta(FLEET_SOFTWARE_COLUMNS.lastUsed),
      },
    ],
    [],
  );

  // In the tab's loading scope the table holds placeholder rows, drawn with their real cells (`loadingCells`): each
  // cell draws its own loading form.
  const data = useMemo(
    () => (loading ? loadingPlaceholderRows<Software>(FLEET_SOFTWARE_SKELETON_ROWS) : software),
    [loading, software],
  );
  const table = useDataTable<Software>({
    data,
    columns,
    getRowId: (row: Software) => String(row.id),
    clientSideSorting: true,
    state: { sorting, columnFilters: EMPTY_COLUMN_FILTERS },
    onSortingChange: setSorting,
  });

  // The device has not answered: the tab draws itself in the loading scope, every part its own skeleton.
  if (!loading) {
    if (!device) {
      return (
        <TabEmptyState
          icon={<WebDesignIcon />}
          title="No software found"
          description="Installed software for this device will appear here."
        />
      );
    }

    if (allSoftware.length === 0) {
      const fleetSource = device.sources?.fleet;

      if (fleetSource === 'error') {
        return (
          <TabEmptyState
            icon={<WebDesignIcon />}
            title="Couldn't load software data"
            description="Fleet didn't respond for this device. Data refreshes automatically — or retry now."
            buttonLabel="Retry"
            onButtonClick={() => queryClient.invalidateQueries({ queryKey: deviceQueryKeys.detail(device.machineId) })}
          />
        );
      }

      if (fleetSource === 'skipped-disconnected') {
        return (
          <TabEmptyState
            icon={<WebDesignIcon />}
            title="Fleet is not connected"
            description="The Fleet agent for this device is disconnected, so its software inventory is unavailable."
          />
        );
      }

      // Agent still deploying → the design's connecting-state copy.
      if (fleetSource === 'skipped-pending') {
        return <TabDeployingEmptyState icon={<WebDesignIcon />} section="Software" />;
      }

      // Not yet collected: the host has never completed a software inventory scan
      // (software_updated_at unset/sentinel).
      if (fleetTimestampMs(device.software_updated_at) === null) {
        return (
          <TabEmptyState
            icon={<WebDesignIcon />}
            title="Collecting software inventory"
            description="This device hasn't reported its installed software yet. It will appear here once the inventory arrives."
          />
        );
      }

      return (
        <TabEmptyState
          icon={<WebDesignIcon />}
          title="No software found"
          description="Installed software for this device will appear here."
        />
      );
    }
  }

  // Empty table → show only the centered empty state: hide the column header always, and
  // hide the search too (unless a search is active, so the user can still clear it).
  const hasSearch = debouncedSearch.trim().length > 0;
  const isEmpty = !loading && software.length === 0;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
      {(!isEmpty || hasSearch) && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 -my-[var(--spacing-system-l)] bg-ods-bg py-[var(--spacing-system-l)]"
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search for Software" />
        </div>
      )}

      <DataTable table={table}>
        {!isEmpty && <DataTable.Header stickyHeader stickyHeaderOffset={stickyHeaderOffset} />}
        <DataTable.Body
          loadingCells={loading}
          skeletonRows={FLEET_SOFTWARE_SKELETON_ROWS}
          rowClassName={LIVE_ROW_GAP_CLASS}
          emptyState={{
            icon: <WebDesignIcon />,
            title: 'No software found',
            description: debouncedSearch
              ? `No results for "${debouncedSearch}".`
              : 'Installed software for this device will appear here.',
          }}
        />
      </DataTable>
    </div>
  );
}
