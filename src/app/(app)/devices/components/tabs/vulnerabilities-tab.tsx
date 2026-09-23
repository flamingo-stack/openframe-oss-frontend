'use client';

import {
  ArrowRightUpIcon,
  BracketSquareCheckIcon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  Input,
  type Row,
  type SortingState,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { cveSeverityRank, resolveCveSeverity } from '@/app/components/shared/cve/cve-severity';
import { CveSeverityTag } from '@/app/components/shared/cve/cve-severity-tag';
import { DateWithAge } from '@/app/components/shared/date-with-age';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import type { Device, Software, Vulnerability } from '../../types/device.types';
import { deviceQueryKeys } from '../../utils/query-keys';
import { getVulnerabilitiesEmptyReason, isVulnerabilityScanPending } from '../../utils/vulnerabilities-empty-state';
import { DataSyncBanner } from '../data-sync-banner';
import { VULNERABILITY_COLUMNS } from './device-tab-columns';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';

interface VulnerabilitiesTabProps {
  device: Device | null;
}

interface VulnerabilityWithSoftware extends Vulnerability {
  software_name: string;
  software_version: string;
  software_vendor?: string;
  software_source: Software['source'];
  unique_key: string; // Unique identifier for React keys
}

const EMPTY_COLUMN_FILTERS: never[] = [];

/** Affected package for the mobile fold — name and version are separate lines from `md`. */
function softwareLabel(vuln: VulnerabilityWithSoftware): string {
  return vuln.software_version ? `${vuln.software_name} · ${vuln.software_version}` : vuln.software_name;
}

/**
 * The band a Fleet vulnerability rates by its CVSS score; null without one —
 * unrated stays unrated rather than being guessed.
 */
function severityOf(vuln: { cvss_score?: number | null }) {
  return resolveCveSeverity(null, vuln.cvss_score);
}

export function VulnerabilitiesTab({ device }: VulnerabilitiesTabProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // Flatten all vulnerabilities from all software, carrying the software context.
  const vulnerabilities = useMemo<VulnerabilityWithSoftware[]>(() => {
    if (!device?.software) return [];

    const flattened: VulnerabilityWithSoftware[] = [];
    device.software.forEach((soft, softwareIndex) => {
      soft.vulnerabilities.forEach((vuln, vulnIndex) => {
        flattened.push({
          ...vuln,
          software_name: soft.name,
          software_version: soft.version,
          software_vendor: soft.vendor,
          software_source: soft.source,
          unique_key: `${vuln.cve}-${soft.name}-${soft.version}-${softwareIndex}-${vulnIndex}`,
        });
      });
    });

    return flattened;
  }, [device]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return vulnerabilities;
    return vulnerabilities.filter(
      vuln => vuln.cve.toLowerCase().includes(query) || vuln.software_name.toLowerCase().includes(query),
    );
  }, [vulnerabilities, search]);

  const columns = useMemo<ColumnDef<VulnerabilityWithSoftware>[]>(
    () => [
      {
        accessorKey: 'cve',
        header: VULNERABILITY_COLUMNS.cve.header,
        cell: ({ row }: { row: Row<VulnerabilityWithSoftware> }) => (
          <div className="flex min-w-0 flex-col justify-center">
            <TruncateText>{row.original.cve}</TruncateText>
            {/* SOFTWARE has a column of its own from `md` up; below that it is folded
                in here, so a mobile row still says which package the CVE is in. */}
            <div className="min-w-0 md:hidden">
              <TruncateText variant="h6" tone="secondary">
                {softwareLabel(row.original)}
              </TruncateText>
            </div>
          </div>
        ),
        meta: liveColumnMeta(VULNERABILITY_COLUMNS.cve),
      },
      {
        id: VULNERABILITY_COLUMNS.severity.id,
        header: VULNERABILITY_COLUMNS.severity.header,
        accessorFn: (row: VulnerabilityWithSoftware) => cveSeverityRank(severityOf(row)),
        cell: ({ row }: { row: Row<VulnerabilityWithSoftware> }) => (
          <CveSeverityTag severity={null} cvssScore={row.original.cvss_score} />
        ),
        enableSorting: true,
        sortingFn: (a: Row<VulnerabilityWithSoftware>, b: Row<VulnerabilityWithSoftware>) =>
          cveSeverityRank(severityOf(a.original)) - cveSeverityRank(severityOf(b.original)),
        meta: liveColumnMeta(VULNERABILITY_COLUMNS.severity),
      },
      {
        accessorKey: 'software_name',
        header: VULNERABILITY_COLUMNS.software.header,
        cell: ({ row }: { row: Row<VulnerabilityWithSoftware> }) => (
          <div className="flex min-w-0 flex-col justify-center">
            <TruncateText>{row.original.software_name}</TruncateText>
            {row.original.software_version && (
              <TruncateText variant="h6" tone="secondary">
                {row.original.software_version}
              </TruncateText>
            )}
          </div>
        ),
        meta: liveColumnMeta(VULNERABILITY_COLUMNS.software),
      },
      {
        accessorKey: 'created_at',
        header: VULNERABILITY_COLUMNS.discovered.header,
        cell: ({ row }: { row: Row<VulnerabilityWithSoftware> }) => <DateWithAge date={row.original.created_at} />,
        enableSorting: true,
        // Least-needed column for mobile triage — hidden below md, where the row keeps
        // CVE (+ the folded-in package), severity and the details button.
        meta: liveColumnMeta(VULNERABILITY_COLUMNS.discovered),
      },
      {
        id: VULNERABILITY_COLUMNS.open.id,
        header: '',
        cell: ({ row }: { row: Row<VulnerabilityWithSoftware> }) =>
          row.original.details_link ? (
            <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
              <Button
                onClick={() => window.open(row.original.details_link, '_blank', 'noopener,noreferrer')}
                variant="outline"
                size="icon"
                leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
                aria-label={`Open ${row.original.cve} details`}
                className="bg-ods-card"
              />
            </div>
          ) : null,
        enableSorting: false,
        meta: liveColumnMeta(VULNERABILITY_COLUMNS.open),
      },
    ],
    [],
  );

  const table = useDataTable<VulnerabilityWithSoftware>({
    data: filtered,
    columns,
    getRowId: (row: VulnerabilityWithSoftware) => row.unique_key,
    clientSideSorting: true,
    state: { sorting, columnFilters: EMPTY_COLUMN_FILTERS },
    onSortingChange: setSorting,
  });

  const sortState = sorting[0] ? { id: sorting[0].id, desc: sorting[0].desc } : null;
  const handleSortChange = useCallback((columnId: string) => {
    setSorting(prev => {
      const current = prev[0];
      if (!current || current.id !== columnId) return [{ id: columnId, desc: false }];
      if (!current.desc) return [{ id: columnId, desc: true }];
      return [];
    });
  }, []);

  if (!device) {
    return (
      <TabEmptyState
        icon={<BracketSquareCheckIcon />}
        title="No vulnerabilities found"
        description="Detected vulnerabilities for this device will appear here."
      />
    );
  }

  // An empty list is only "no vulnerabilities" once the pipeline actually ran —
  // otherwise say which stage it is at. A non-empty list renders as usual (a
  // stale scan alongside existing results is intentionally not flagged).
  if (vulnerabilities.length === 0) {
    const reason = getVulnerabilitiesEmptyReason(device);

    if (reason === 'error') {
      return (
        <TabEmptyState
          icon={<BracketSquareCheckIcon />}
          title="Couldn't load vulnerability data"
          description="Fleet didn't respond for this device. Data refreshes automatically — or retry now."
          buttonLabel="Retry"
          onButtonClick={() => queryClient.invalidateQueries({ queryKey: deviceQueryKeys.detail(device.machineId) })}
        />
      );
    }

    if (reason === 'disconnected') {
      return (
        <TabEmptyState
          icon={<BracketSquareCheckIcon />}
          title="Fleet is not connected"
          description="The Fleet agent for this device is disconnected, so vulnerability data is unavailable."
        />
      );
    }

    if (reason === 'collecting') {
      // Agent still deploying → the design's connecting-state copy;
      // agent live but the first inventory scan hasn't finished → collecting copy.
      if (device.sources?.fleet === 'skipped-pending') {
        return <TabDeployingEmptyState icon={<BracketSquareCheckIcon />} section="Vulnerabilities" />;
      }
      return (
        <TabEmptyState
          icon={<BracketSquareCheckIcon />}
          title="Collecting software inventory"
          description="This device hasn't reported its installed software yet. Vulnerabilities will appear once the inventory arrives."
        />
      );
    }

    if (reason === 'scan-pending') {
      return (
        <TabEmptyState
          icon={<BracketSquareCheckIcon />}
          title="Vulnerability scan pending"
          description="The latest software inventory hasn't been checked for vulnerabilities yet. Check back shortly."
        />
      );
    }

    return (
      <TabEmptyState
        icon={<BracketSquareCheckIcon />}
        title="No vulnerabilities found"
        description="Detected vulnerabilities for this device will appear here."
      />
    );
  }

  // Empty table → show only the centered empty state: hide the column header always, and
  // hide the search too (unless a search is active, so the user can still clear it).
  const hasSearch = search.trim().length > 0;
  const isEmpty = filtered.length === 0;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
      {/* Results are on screen but the last matching run predates the current
          software inventory — e.g. a patched CVE may still show as active until
          the hourly run catches up. */}
      {isVulnerabilityScanPending(device) && <DataSyncBanner />}

      {(!isEmpty || hasSearch) && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 -my-[var(--spacing-system-l)] bg-ods-bg py-[var(--spacing-system-l)]"
        >
          <Input
            placeholder="Search for Vulnerability"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
            startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
          />
        </div>
      )}

      <DataTable table={table}>
        {!isEmpty && (
          <DataTable.Header
            sort={sortState}
            onSortChange={handleSortChange}
            stickyHeader
            stickyHeaderOffset={stickyHeaderOffset}
          />
        )}
        <DataTable.Body
          rowClassName="mb-1"
          emptyState={{
            icon: <BracketSquareCheckIcon />,
            title: 'No vulnerabilities found',
            description: search.trim()
              ? `No results for "${search.trim()}".`
              : 'Detected vulnerabilities for this device will appear here.',
          }}
        />
      </DataTable>
    </div>
  );
}
