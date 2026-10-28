'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { providerMark } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  FilterModal,
  FloatingTooltip,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { memo, useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  userLicencesTabQuery$data,
  userLicencesTabQuery as UserLicencesTabQueryType,
} from '@/__generated__/userLicencesTabQuery.graphql';
import { liveColumnMeta, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { singleColumnFilter } from '../../../software/components/shared/column-filters';
import { UserTabHeading } from './user-tab-heading';

/** The selected account's licences, one per SKU (contract §2, S3), read whole: an account holds a handful. */
const userLicencesTabQuery = graphql`
  query userLicencesTabQuery($id: ID!) {
    directoryAccount(id: $id) {
      source
      licenses {
        skuId
        name
        assignedDirectly
        viaGroups {
          name
        }
      }
    }
  }
`;

type Licence = NonNullable<userLicencesTabQuery$data['directoryAccount']>['licenses'][number];

const DIRECT = 'DIRECT';
const VIA_GROUP = 'VIA_GROUP';

// Figma 1014:2605: the licence takes the row, the tags a narrow column at its end, then the rows' action gutter. A
// phone has no gutter: the tags sit at the row's end (1019:37231).
const LICENCE_COLUMNS = {
  licence: { id: 'licence', header: 'Licence', width: 'flex-1 min-w-0' },
  assignment: { id: 'assignment', header: 'Assignment', width: 'w-28 shrink-0' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md' },
} satisfies Record<string, TableSkeletonColumn>;

const ASSIGNMENT_OPTIONS = [
  { id: DIRECT, label: 'Direct', value: DIRECT },
  { id: VIA_GROUP, label: 'Via group', value: VIA_GROUP },
];

/** A row as its cells read it; every field but `id` is absent on a loading row. */
interface LicenceRow {
  id: string;
  name?: string;
  source?: string;
  /** DIRECT, VIA_GROUP or both: a SKU can be assigned directly and inherited at once. */
  assignments?: string[];
  viaGroups?: string[];
}

function toLicenceRow(licence: Licence, source: string): LicenceRow {
  return {
    id: licence.skuId,
    name: licence.name,
    source,
    assignments: [...(licence.assignedDirectly ? [DIRECT] : []), ...(licence.viaGroups.length > 0 ? [VIA_GROUP] : [])],
    viaGroups: licence.viaGroups.map(group => group.name ?? 'A deleted group'),
  };
}

function LicenceCell({ row }: { row: LicenceRow }) {
  const loading = useLoadingScope();
  const mark = row.source ? providerMark(row.source) : null;
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
      {mark && <mark.Logo data-loading-optional size={24} role="img" aria-label={mark.label} />}
      <TruncateText className={loading ? 'w-40' : undefined}>{row.name ?? ''}</TruncateText>
    </div>
  );
}

/** DIRECT and VIA GROUP tags (Figma 1014:2523); the inherited one names its groups. Both wrap in the narrow column. */
function AssignmentCell({ row }: { row: LicenceRow }) {
  const loading = useLoadingScope();
  const assignments = row.assignments ?? [DIRECT];
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-[var(--spacing-system-xxs)] content-md:justify-start">
      {assignments.includes(DIRECT) && <Tag label="Direct" variant="grey" loading={loading} />}
      {assignments.includes(VIA_GROUP) && (
        <FloatingTooltip
          as="span"
          content={
            <>
              {(row.viaGroups ?? []).map(name => (
                <p key={name}>{name}</p>
              ))}
              <p>An inherited seat can’t be released from the user.</p>
            </>
          }
        >
          <Tag data-loading-optional label="Via group" variant="grey" />
        </FloatingTooltip>
      )}
    </div>
  );
}

const assignmentFilterFn = (row: Row<LicenceRow>, _columnId: string, selected: string[] | undefined) =>
  !selected?.length || (row.original.assignments ?? []).some(assignment => selected.includes(assignment));

const COLUMNS: ColumnDef<LicenceRow>[] = [
  {
    id: LICENCE_COLUMNS.licence.id,
    header: LICENCE_COLUMNS.licence.header,
    cell: ({ row }: { row: Row<LicenceRow> }) => <LicenceCell row={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(LICENCE_COLUMNS.licence),
  },
  {
    id: LICENCE_COLUMNS.assignment.id,
    header: LICENCE_COLUMNS.assignment.header,
    accessorFn: row => row.assignments,
    cell: ({ row }: { row: Row<LicenceRow> }) => <AssignmentCell row={row.original} />,
    enableSorting: false,
    filterFn: assignmentFilterFn,
    meta: liveColumnMeta(LICENCE_COLUMNS.assignment, { filter: { options: ASSIGNMENT_OPTIONS } }),
  },
  { id: LICENCE_COLUMNS.open.id, cell: () => null, enableSorting: false, meta: liveColumnMeta(LICENCE_COLUMNS.open) },
];

/** The phone's filter window (Figma 1019:37231): the Assignment funnel the column header carries from `content-md`. */
const ASSIGNMENT_FILTER_GROUPS = [
  {
    id: LICENCE_COLUMNS.assignment.id,
    title: LICENCE_COLUMNS.assignment.header,
    options: ASSIGNMENT_OPTIONS.map(({ id, label }) => ({ id, label })),
  },
];

const getRowId = (row: LicenceRow) => row.id;
const LICENCES_SKELETON_ROWS = 3;

/** The heading and the table, from the rows it is handed (`null` while they are read). */
function LicencesTable({ rows }: { rows: readonly LicenceRow[] | null }) {
  const loading = useLoadingScope();
  const [selected, setSelected] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { columnFilters, onColumnFiltersChange } = singleColumnFilter(
    LICENCE_COLUMNS.assignment.id,
    selected,
    setSelected,
  );
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<LicenceRow>(LICENCES_SKELETON_ROWS) : null),
    [loading],
  );
  const table = useDataTable<LicenceRow>({
    data: placeholderRows ?? ((rows ?? []) as LicenceRow[]),
    columns: COLUMNS,
    getRowId,
    enableSorting: false,
    // The list is read whole, so the funnel narrows it here rather than in a query.
    clientSideFiltering: true,
    state: { columnFilters },
    onColumnFiltersChange,
  });
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <UserTabHeading
        title="Licences"
        actions={
          <Button
            variant="outline"
            size="icon"
            className="content-md:hidden"
            onClick={() => setFiltersOpen(true)}
            disabled={loading}
            aria-label="Open filters"
            leftIcon={<Filter02Icon className="text-ods-text-primary" />}
          />
        }
      />
      <LiveTable
        table={table}
        skeletonRows={LICENCES_SKELETON_ROWS}
        loadingCells={loading}
        stickyHeader={false}
        itemName="result"
        emptyState={oneLineEmptyState(
          selected.length > 0 ? 'No licences match the selected filters.' : 'This user holds no licences.',
        )}
      />
      <FilterModal
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filterGroups={ASSIGNMENT_FILTER_GROUPS}
        currentFilters={{ [LICENCE_COLUMNS.assignment.id]: selected }}
        onFilterChange={filters => setSelected(filters[LICENCE_COLUMNS.assignment.id] ?? [])}
      />
    </div>
  );
}

/** User page → Licences (Figma 1014:2523). `memo`'d: `TabNavigation` defers the body. */
export const UserLicencesTab = memo(function UserLicencesTabImpl({
  id,
  loading = false,
}: {
  id: string;
  loading?: boolean;
}) {
  return (
    <LoadingSuspense live label="Loading licences" gated={loading}>
      <UserLicencesReader id={id} />
    </LoadingSuspense>
  );
});

function UserLicencesReader({ id }: { id: string }) {
  if (useLoadingScope()) return <LicencesTable rows={null} />;
  return <UserLicencesQuery id={id} />;
}

function UserLicencesQuery({ id }: { id: string }) {
  const retryKey = useRetryKey();
  const { directoryAccount } = useLazyLoadQuery<UserLicencesTabQueryType>(
    userLicencesTabQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  // A missing account is the header's to say ("User not found").
  if (!directoryAccount) return null;
  return (
    <LicencesTable rows={directoryAccount.licenses.map(licence => toLicenceRow(licence, directoryAccount.source))} />
  );
}
