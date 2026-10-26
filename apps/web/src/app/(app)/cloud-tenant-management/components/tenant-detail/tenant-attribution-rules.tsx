'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  type DataTableFilterOption,
  type Row,
  type SortingState,
  Tag,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo, useState } from 'react';
import { graphql, useFragment, useLazyLoadQuery } from 'react-relay';
import type {
  tenantAttributionRules_connection$data,
  tenantAttributionRules_connection$key,
} from '@/__generated__/tenantAttributionRules_connection.graphql';
import type { tenantAttributionRulesQuery as TenantAttributionRulesQueryType } from '@/__generated__/tenantAttributionRulesQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { ValueText } from '@/app/components/shared/value-text';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { missingValuesBadge, ruleKindLabel } from '../../utils/tenant-presentation';
import { boundCustomerOption } from '../tenant-form/bound-customer';

// A fragment, so Save re-selects it (`useSaveIntegrationMutation`) and a saved set lands here with its counts.
const tenantAttributionRulesFragment = graphql`
  fragment tenantAttributionRules_connection on DirectoryConnection {
    customers {
      ...boundCustomer_customer
      rules {
        kind
        values {
          id
          name
        }
        userCount
      }
    }
  }
`;

// Its own query, like the integration section: a value's `name` is the directory's display name, and the page's
// record should not wait for it.
const tenantAttributionRulesQuery = graphql`
  query tenantAttributionRulesQuery($id: ID!) {
    directoryConnection(connectionId: $id) {
      ...tenantAttributionRules_connection
    }
  }
`;

type Customers = tenantAttributionRules_connection$data['customers'];

/** One rule of one customer: a row of the table (Figma 3065-17490). */
interface AttributionRuleRow {
  id: string;
  customer: string;
  /** "Archived" / "Deleted": the customer stays bound, and its users count as unattributed. */
  badge?: string;
  matchBy: string;
  /** `null` for a rule with no values (`ALL`): the empty mark. A value the directory no longer has reads as its id. */
  values: string | null;
  /** "Not in directory" while some of `values` are gone from the directory: the rule claims nobody through them. */
  valuesBadge: string | null;
  /** `undefined` until the first sync counts anyone: sorts last in both directions. */
  users: number | undefined;
}

const ATTRIBUTION_RULE_COLUMNS = {
  customer: { id: 'customer', header: 'Customer', width: 'flex-1 min-w-0' },
  matchBy: { id: 'matchBy', header: 'Match by', width: 'flex-1 min-w-0', hideAt: 'lg' },
  values: { id: 'values', header: 'Values', width: 'flex-1 min-w-0', hideAt: 'md' },
  users: { id: 'users', header: 'Users', width: 'w-28 shrink-0', sortable: true },
} satisfies Record<string, TableSkeletonColumn>;

/** A typical tenant: one customer, one or two rules. */
const ATTRIBUTION_RULES_SKELETON_ROWS = 2;

function toRows(customers: Customers): AttributionRuleRow[] {
  return customers.flatMap(customer => {
    const { organizationId, name, badge } = boundCustomerOption(customer);
    return customer.rules.map((rule, index) => ({
      id: `${organizationId}:${index}`,
      customer: name,
      badge,
      matchBy: ruleKindLabel(rule.kind),
      values: rule.values.length > 0 ? rule.values.map(value => value.name ?? value.id).join(', ') : null,
      valuesBadge: missingValuesBadge(rule.values.filter(value => value.name == null).length),
      users: rule.userCount ?? undefined,
    }));
  });
}

const getRowId = (row: AttributionRuleRow) => row.id;

/** A filter's options: the values the rows actually hold, so no option can only ever empty the table. */
function optionsOf(rows: readonly AttributionRuleRow[], key: 'customer' | 'matchBy'): DataTableFilterOption[] {
  return [...new Set(rows.map(row => row[key]))].sort().map(label => ({ id: label, label, value: label }));
}

function attributionRuleColumns(
  customerOptions: DataTableFilterOption[],
  matchByOptions: DataTableFilterOption[],
): ColumnDef<AttributionRuleRow>[] {
  return [
    {
      accessorKey: 'customer',
      header: ATTRIBUTION_RULE_COLUMNS.customer.header,
      cell: ({ row }: { row: Row<AttributionRuleRow> }) => (
        <span className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
          <ValueText value={row.original.customer} />
          {row.original.badge && <Tag as="span" variant="warning" label={row.original.badge} className="shrink-0" />}
        </span>
      ),
      filterFn: multiSelectFilterFn,
      enableSorting: false,
      meta: liveColumnMeta(ATTRIBUTION_RULE_COLUMNS.customer, { filter: { options: customerOptions } }),
    },
    {
      accessorKey: 'matchBy',
      header: ATTRIBUTION_RULE_COLUMNS.matchBy.header,
      cell: ({ row }: { row: Row<AttributionRuleRow> }) => <ValueText value={row.original.matchBy} />,
      filterFn: multiSelectFilterFn,
      enableSorting: false,
      meta: liveColumnMeta(ATTRIBUTION_RULE_COLUMNS.matchBy, { filter: { options: matchByOptions } }),
    },
    {
      accessorKey: 'values',
      header: ATTRIBUTION_RULE_COLUMNS.values.header,
      cell: ({ row }: { row: Row<AttributionRuleRow> }) => (
        <span className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
          <ValueText value={row.original.values} />
          {row.original.valuesBadge && (
            <Tag as="span" variant="warning" label={row.original.valuesBadge} className="shrink-0" />
          )}
        </span>
      ),
      enableSorting: false,
      meta: liveColumnMeta(ATTRIBUTION_RULE_COLUMNS.values),
    },
    {
      accessorKey: 'users',
      header: ATTRIBUTION_RULE_COLUMNS.users.header,
      cell: ({ row }: { row: Row<AttributionRuleRow> }) => <ValueText value={row.original.users} />,
      sortUndefined: 'last',
      meta: liveColumnMeta(ATTRIBUTION_RULE_COLUMNS.users),
    },
  ];
}

function AttributionRulesTable({ customers }: { customers: Customers | null }) {
  const loading = customers == null;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  // Memoized for the table instance, which keys its row model on their identity.
  const rows = useMemo(() => (customers ? toRows(customers) : []), [customers]);
  const data = useMemo(
    () => (loading ? loadingPlaceholderRows<AttributionRuleRow>(ATTRIBUTION_RULES_SKELETON_ROWS) : rows),
    [loading, rows],
  );
  const columns = useMemo(
    () => attributionRuleColumns(optionsOf(rows, 'customer'), optionsOf(rows, 'matchBy')),
    [rows],
  );
  const table = useDataTable<AttributionRuleRow>({
    data,
    columns,
    getRowId,
    clientSideSorting: true,
    clientSideFiltering: true,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  });

  // Ascending, descending, then back to the order the rules were written in.
  const handleSortChange = (columnId: string) => {
    setSorting(previous => {
      const current = previous[0];
      if (!current || current.id !== columnId) return [{ id: columnId, desc: false }];
      if (!current.desc) return [{ id: columnId, desc: true }];
      return [];
    });
  };
  const sort = sorting[0] ? { id: sorting[0].id, desc: sorting[0].desc } : null;

  return (
    <section className="flex flex-col gap-[var(--spacing-system-l)]">
      <h2 className="text-ods-text-primary text-h2">Attribution Rules</h2>
      <DataTable table={table}>
        <DataTable.Header rightSlot={<DataTable.RowCount />} sort={sort} onSortChange={handleSortChange} />
        <DataTable.Body
          loading={loading}
          loadingCells={loading}
          skeletonRows={ATTRIBUTION_RULES_SKELETON_ROWS}
          emptyState={
            rows.length === 0
              ? {
                  title: 'No customers yet',
                  description: 'Choose the customers this directory serves in Edit Integration.',
                }
              : { title: 'No rules match', description: 'Try adjusting your filters.' }
          }
        />
      </DataTable>
    </section>
  );
}

/** "Attribution Rules": every customer's rules with the users each one claims, with its own boundary. */
export function TenantAttributionRules({ id }: { id: string }) {
  return (
    <LoadingSuspense label="Loading attribution rules">
      <TenantAttributionRulesReader id={id} />
    </LoadingSuspense>
  );
}

/** In a loading scope (its boundary's fallback, or the page's) it reads nothing and draws the table's placeholder rows. */
function TenantAttributionRulesReader({ id }: { id: string }) {
  if (useLoadingScope()) {
    return <AttributionRulesTable customers={null} />;
  }
  return <TenantAttributionRulesQuery id={id} />;
}

function TenantAttributionRulesQuery({ id }: { id: string }) {
  const retryKey = useRetryKey();
  const { directoryConnection } = useLazyLoadQuery<TenantAttributionRulesQueryType>(
    tenantAttributionRulesQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  // The page above has already said "not found" for a missing record.
  if (!directoryConnection) return null;
  return <TenantAttributionRulesRecord connection={directoryConnection} />;
}

function TenantAttributionRulesRecord({ connection }: { connection: tenantAttributionRules_connection$key }) {
  const { customers } = useFragment(tenantAttributionRulesFragment, connection);
  return <AttributionRulesTable customers={customers} />;
}
