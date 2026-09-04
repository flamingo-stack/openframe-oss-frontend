'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
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
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import { useQueryClient } from '@tanstack/react-query';
import { type ComponentType, useMemo, useState } from 'react';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import type { Device, Software } from '../../types/device.types';
import { fleetTimestampMs } from '../../utils/fleet-timestamp';
import { deviceQueryKeys } from '../../utils/query-keys';
import { SOFTWARE_COLUMNS } from './device-tab-columns';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';

interface SoftwareTabProps {
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

function formatLastUsed(dateString?: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.getTime() > 0 ? formatRelativeTime(date) : '—';
}

export function SoftwareTab({ device }: SoftwareTabProps) {
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
        header: SOFTWARE_COLUMNS.name.header,
        cell: ({ row }: { row: Row<Software> }) => (
          <div className="flex min-w-0 flex-col justify-center">
            <TruncateText>{row.original.name}</TruncateText>
            {row.original.version && (
              <TruncateText variant="h6" tone="secondary">
                {row.original.version}
              </TruncateText>
            )}
          </div>
        ),
        enableSorting: true,
        meta: liveColumnMeta(SOFTWARE_COLUMNS.name),
      },
      {
        accessorKey: 'source',
        header: SOFTWARE_COLUMNS.source.header,
        cell: ({ row }: { row: Row<Software> }) => {
          const { Icon, label } = getSourceIcon(row.original.source);
          return (
            <div className="inline-flex min-w-0 items-center gap-[var(--spacing-system-xs)] text-ods-text-secondary">
              <Icon className="h-4 w-4 shrink-0 md:h-6 md:w-6" />
              <div className="min-w-0">
                <TruncateText tone="secondary">{label}</TruncateText>
              </div>
            </div>
          );
        },
        enableSorting: true,
        meta: liveColumnMeta(SOFTWARE_COLUMNS.source),
      },
      {
        id: SOFTWARE_COLUMNS.vulnerabilities.id,
        header: SOFTWARE_COLUMNS.vulnerabilities.header,
        accessorFn: (row: Software) => row.vulnerabilities.length,
        cell: ({ row }: { row: Row<Software> }) => {
          const vulnCount = row.original.vulnerabilities.length;
          if (vulnCount === 0) {
            return <Tag label="NO ISSUES" variant="success" className="w-fit" />;
          }
          return (
            <Tag label={`${vulnCount} ${vulnCount === 1 ? 'ISSUE' : 'ISSUES'}`} variant="error" className="w-fit" />
          );
        },
        enableSorting: true,
        sortingFn: (rowA: Row<Software>, rowB: Row<Software>) => {
          const a = rowA.original.vulnerabilities.length;
          const b = rowB.original.vulnerabilities.length;
          if (a === b) return 0;
          return a > b ? 1 : -1;
        },
        meta: liveColumnMeta(SOFTWARE_COLUMNS.vulnerabilities),
      },
      {
        id: SOFTWARE_COLUMNS.filePath.id,
        header: SOFTWARE_COLUMNS.filePath.header,
        accessorFn: (row: Software) => row.installed_paths?.[0] ?? '',
        cell: ({ row }: { row: Row<Software> }) => {
          const path = row.original.installed_paths?.[0];
          return path ? (
            <TruncateText>{path}</TruncateText>
          ) : (
            <span className="text-ods-text-secondary text-h4">—</span>
          );
        },
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_COLUMNS.filePath),
      },
      {
        accessorKey: 'last_opened_at',
        header: SOFTWARE_COLUMNS.lastUsed.header,
        cell: ({ row }: { row: Row<Software> }) => (
          <div className="text-ods-text-primary text-h6">{formatLastUsed(row.original.last_opened_at)}</div>
        ),
        enableSorting: true,
        meta: liveColumnMeta(SOFTWARE_COLUMNS.lastUsed),
      },
    ],
    [],
  );

  const table = useDataTable<Software>({
    data: software,
    columns,
    getRowId: (row: Software) => String(row.id),
    clientSideSorting: true,
    state: { sorting, columnFilters: EMPTY_COLUMN_FILTERS },
    onSortingChange: setSorting,
  });

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

    // Agent still deploying → the design's connecting-state copy (447-30846).
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

  // Empty table → show only the centered empty state: hide the column header always, and
  // hide the search too (unless a search is active, so the user can still clear it).
  const hasSearch = debouncedSearch.trim().length > 0;
  const isEmpty = software.length === 0;

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
          rowClassName="mb-1"
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
