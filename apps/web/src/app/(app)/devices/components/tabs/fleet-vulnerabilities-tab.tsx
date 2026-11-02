'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
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
  Tag,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { cveSeverityRank, resolveCveSeverity } from '@/app/components/shared/cve/cve-severity';
import { CveSeverityTag } from '@/app/components/shared/cve/cve-severity-tag';
import { DateWithAge } from '@/app/components/shared/date-with-age';
import { LIVE_ROW_GAP_CLASS, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import type { Device, Software, Vulnerability } from '../../types/device.types';
import { deviceQueryKeys } from '../../utils/query-keys';
import { getVulnerabilitiesEmptyReason, isVulnerabilityScanPending } from '../../utils/vulnerabilities-empty-state';
import { DataSyncBanner } from '../data-sync-banner';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';

/**
 * Vulnerabilities tab over the Fleet host payload (`software-management` off).
 *
 * Below `md` the row is CVE + severity + the details button only. The percentage
 * widths this table uses on desktop are unusable there — on a 375px viewport the
 * row's inner width is ~310px, so `20%`/`16%` resolve to ~62px/~50px and the row
 * (which is `overflow-hidden`) clipped both the CVE id and the severity tag.
 * So CVE takes the leftover space, severity gets the fixed width its tag needs,
 * and SOFTWARE drops out of the row — `FleetVulnerabilitiesTab` folds the package
 * name into the CVE cell as a second line there, which DISCOVERED has no
 * equivalent of and is the least useful of the three for mobile triage anyway.
 */
const FLEET_VULNERABILITY_COLUMNS = {
  cve: { id: 'cve', header: 'CVE ID', width: 'flex-1 min-w-0 content-md:flex-none content-md:w-[20%]' },
  severity: { id: 'severity', header: 'SEVERITY', width: 'w-[88px] content-md:w-[16%]', sortable: true },
  software: { id: 'software_name', header: 'SOFTWARE', width: 'flex-1 min-w-0', hideAt: 'md' },
  discovered: { id: 'created_at', header: 'DISCOVERED', width: 'w-[18%]', sortable: true, hideAt: 'md' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

interface FleetVulnerabilitiesTabProps {
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

/**
 * Rows the loading table holds (placeholder rows, drawn with their real cells): the list is read whole, so this is the
 * body's own default count (the lib's `DATA_TABLE_SKELETON_ROWS`), stated here so the rows and the body agree.
 */
const FLEET_VULNERABILITIES_SKELETON_ROWS = 10;

/** A placeholder row has no `unique_key`: it is keyed by its own id. */
const vulnerabilityRowId = (row: VulnerabilityWithSoftware) => row.unique_key ?? (row as { id?: string }).id ?? '';

/** The CVE's band and score; the tag's own skeleton on a loading row (a placeholder is not "unrated"). */
function SeverityCell({ cvssScore }: { cvssScore: number | null | undefined }) {
  if (useLoadingScope()) return <Tag label="" loading />;
  return <CveSeverityTag severity={null} cvssScore={cvssScore} />;
}

/** The package name over its version; on a loading row both lines draw their bars (`TruncateText` with no text). */
function SoftwareCell({ name, version }: { name: string; version: string | undefined }) {
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

/** When the CVE was found, over its age (`DateWithAge`); on a loading row the same two lines as bars. */
function DiscoveredCell({ date }: { date: string | undefined }) {
  if (useLoadingScope()) {
    return (
      <div className="flex min-w-0 flex-col justify-center">
        <TextLineSkeleton type="h4" className="w-3/4" />
        <TextLineSkeleton type="h6" className="w-3/4" />
      </div>
    );
  }
  return <DateWithAge date={date} />;
}

/** Opens Fleet's details link; static chrome, drawn real and inert on a loading row. */
function OpenDetailsButton({ vuln }: { vuln: VulnerabilityWithSoftware }) {
  const loading = useLoadingScope();
  if (!loading && !vuln.details_link) return null;
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={() => window.open(vuln.details_link, '_blank', 'noopener,noreferrer')}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label={loading ? 'Open details' : `Open ${vuln.cve} details`}
        className="bg-ods-card"
        disabled={loading}
      />
    </div>
  );
}

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

/**
 * Device → Vulnerabilities over the Fleet host payload: every CVE on every title
 * in `device.software` (mapped in `use-device-details.ts`), flattened with the
 * package it sits in, searched and sorted client-side. What `VulnerabilitiesTab`
 * draws while `software-management` is off; with the module on it draws the
 * module's table instead (`vulnerabilities-tab.tsx`). The trailing button opens
 * Fleet's `details_link` (NVD) — without the module there is no CVE page to open.
 */
export function FleetVulnerabilitiesTab({ device }: FleetVulnerabilitiesTabProps) {
  const loading = useLoadingScope();
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
        header: FLEET_VULNERABILITY_COLUMNS.cve.header,
        cell: ({ row }: { row: Row<VulnerabilityWithSoftware> }) => (
          <div className="flex min-w-0 flex-col justify-center">
            <TruncateText>{row.original.cve}</TruncateText>
            {/* SOFTWARE has a column of its own from `md` up; below that it is folded
                in here, so a mobile row still says which package the CVE is in. */}
            <div className="min-w-0 content-md:hidden">
              <TruncateText variant="h6" tone="secondary">
                {softwareLabel(row.original)}
              </TruncateText>
            </div>
          </div>
        ),
        meta: liveColumnMeta(FLEET_VULNERABILITY_COLUMNS.cve),
      },
      {
        id: FLEET_VULNERABILITY_COLUMNS.severity.id,
        header: FLEET_VULNERABILITY_COLUMNS.severity.header,
        accessorFn: (row: VulnerabilityWithSoftware) => cveSeverityRank(severityOf(row)),
        cell: ({ row }: { row: Row<VulnerabilityWithSoftware> }) => (
          <SeverityCell cvssScore={row.original.cvss_score} />
        ),
        enableSorting: true,
        sortingFn: (a: Row<VulnerabilityWithSoftware>, b: Row<VulnerabilityWithSoftware>) =>
          cveSeverityRank(severityOf(a.original)) - cveSeverityRank(severityOf(b.original)),
        meta: liveColumnMeta(FLEET_VULNERABILITY_COLUMNS.severity),
      },
      {
        accessorKey: 'software_name',
        header: FLEET_VULNERABILITY_COLUMNS.software.header,
        cell: ({ row }: { row: Row<VulnerabilityWithSoftware> }) => (
          <SoftwareCell name={row.original.software_name} version={row.original.software_version} />
        ),
        meta: liveColumnMeta(FLEET_VULNERABILITY_COLUMNS.software),
      },
      {
        accessorKey: 'created_at',
        header: FLEET_VULNERABILITY_COLUMNS.discovered.header,
        cell: ({ row }: { row: Row<VulnerabilityWithSoftware> }) => <DiscoveredCell date={row.original.created_at} />,
        enableSorting: true,
        // Least-needed column for mobile triage — hidden below md, where the row keeps
        // CVE (+ the folded-in package), severity and the details button.
        meta: liveColumnMeta(FLEET_VULNERABILITY_COLUMNS.discovered),
      },
      {
        id: FLEET_VULNERABILITY_COLUMNS.open.id,
        header: '',
        cell: ({ row }: { row: Row<VulnerabilityWithSoftware> }) => <OpenDetailsButton vuln={row.original} />,
        enableSorting: false,
        meta: liveColumnMeta(FLEET_VULNERABILITY_COLUMNS.open),
      },
    ],
    [],
  );

  // In the tab's loading scope the table holds placeholder rows, drawn with their real cells (`loadingCells`): each
  // cell draws its own loading form.
  const data = useMemo(
    () => (loading ? loadingPlaceholderRows<VulnerabilityWithSoftware>(FLEET_VULNERABILITIES_SKELETON_ROWS) : filtered),
    [loading, filtered],
  );
  const table = useDataTable<VulnerabilityWithSoftware>({
    data,
    columns,
    getRowId: vulnerabilityRowId,
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

  // The device has not answered: the tab draws itself in the loading scope, every part its own skeleton.
  if (!loading) {
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
  }

  // Empty table → show only the centered empty state: hide the column header always, and
  // hide the search too (unless a search is active, so the user can still clear it).
  const hasSearch = search.trim().length > 0;
  const isEmpty = !loading && filtered.length === 0;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
      {/* Results are on screen but the last matching run predates the current software inventory — e.g. a patched
          CVE may still show as active until the hourly run catches up. A status line, so it heads the tab. */}
      {!loading && device && isVulnerabilityScanPending(device) && <DataSyncBanner data-loading-optional />}

      {(!isEmpty || hasSearch) && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 -my-[var(--spacing-system-l)] bg-ods-bg py-[var(--spacing-system-l)]"
        >
          <Input
            userValue
            placeholder="Search for Vulnerability"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
            startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
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
          loadingCells={loading}
          skeletonRows={FLEET_VULNERABILITIES_SKELETON_ROWS}
          rowClassName={LIVE_ROW_GAP_CLASS}
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
