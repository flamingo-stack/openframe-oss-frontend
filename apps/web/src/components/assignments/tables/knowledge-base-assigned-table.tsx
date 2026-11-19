'use client';

import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  Input,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import type { knowledgeBaseItemCreatedCell_item$data } from '@/__generated__/knowledgeBaseItemCreatedCell_item.graphql';
import { ItemTimestamp } from '@/app/(app)/knowledge-base/components/shared/item-timestamp';
import {
  KNOWLEDGE_BASE_DATE_GRID,
  KNOWLEDGE_BASE_NAME_GRID,
  knowledgeBaseOpenColumn,
} from '@/app/(app)/knowledge-base/components/shared/knowledge-base-grid-columns';
import { KNOWLEDGE_BASE_ITEM_COLUMNS } from '@/app/(app)/knowledge-base/components/shared/knowledge-base-item-columns';
import {
  KnowledgeBaseItemName,
  type KnowledgeBaseItemNameProps,
} from '@/app/(app)/knowledge-base/components/shared/knowledge-base-item-name';
import { liveColumnMeta, oneLineEmptyState } from '@/app/components/shared';
import { useGridTableProps } from '@/app/hooks/use-table-layout';
import { routes } from '@/lib/routes';
import { ASSIGNED_ITEMS_SKELETON_ROWS } from '../use-assigned-items';

/**
 * An assigned article as this table draws it. The assignments are read by raw
 * POST, so there is no fragment reference to hand the knowledge base's cells;
 * the row is typed off their fragments instead, which makes a field the query
 * stops selecting a compile error rather than an empty column.
 */
export type AssignedArticle = { readonly id: string } & KnowledgeBaseItemNameProps &
  Pick<knowledgeBaseItemCreatedCell_item$data, 'createdAt'>;

const getRowId = (row: AssignedArticle) => row.id;
const rowHref = (row: AssignedArticle) => routes.knowledgeBase.details(row.id);

// The knowledge base listing's own columns, minus the row menu: an assignment is edited on the article's form.
const COLUMNS: ColumnDef<AssignedArticle>[] = [
  {
    id: KNOWLEDGE_BASE_ITEM_COLUMNS.name.id,
    header: KNOWLEDGE_BASE_ITEM_COLUMNS.name.header,
    cell: ({ row }: { row: Row<AssignedArticle> }) => (
      <KnowledgeBaseItemName
        type={row.original.type}
        name={row.original.name}
        status={row.original.status}
        summary={row.original.summary}
      />
    ),
    enableSorting: false,
    ...KNOWLEDGE_BASE_NAME_GRID,
    meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.name, {
      label: 'Name',
      gridCell: ({ row }: { row: Row<AssignedArticle> }) => (
        <KnowledgeBaseItemName
          type={row.original.type}
          name={row.original.name}
          status={row.original.status}
          summary={row.original.summary}
          grid
        />
      ),
    }),
  },
  {
    id: KNOWLEDGE_BASE_ITEM_COLUMNS.created.id,
    header: KNOWLEDGE_BASE_ITEM_COLUMNS.created.header,
    cell: ({ row }: { row: Row<AssignedArticle> }) =>
      row.original.createdAt ? <ItemTimestamp value={row.original.createdAt} /> : null,
    enableSorting: false,
    ...KNOWLEDGE_BASE_DATE_GRID,
    meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.created, {
      label: 'Created',
      gridCell: ({ row }: { row: Row<AssignedArticle> }) =>
        row.original.createdAt ? <ItemTimestamp value={row.original.createdAt} grid /> : null,
    }),
  },
  knowledgeBaseOpenColumn<AssignedArticle>(rowHref),
];

/** The key of the viewer's saved column layout. */
const ASSIGNED_ARTICLES_PANEL_KEY = 'assignments-articles';
const NO_ARTICLES: AssignedArticle[] = [];

interface KnowledgeBaseAssignedTableProps {
  articles: AssignedArticle[];
  isLoading?: boolean;
}

export function KnowledgeBaseAssignedTable({ articles, isLoading }: KnowledgeBaseAssignedTableProps) {
  // The new grid table, behind the app's one table flag; card rows while it is off. The panel is a section of a
  // longer page, so the table keeps its natural height. While the flag is read the table draws its loading rows: it
  // never draws one layout and swaps to the other.
  const tableGrid = useGridTableProps(ASSIGNED_ARTICLES_PANEL_KEY);
  const grid = tableGrid.layout === 'grid';
  const loading = isLoading || tableGrid.loading;
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // The whole list is already here, so the search narrows it in place.
  const needle = debouncedSearch.trim().toLowerCase();
  const rows = needle
    ? articles.filter(
        article =>
          article.name.toLowerCase().includes(needle) || (article.summary ?? '').toLowerCase().includes(needle),
      )
    : articles;

  const table = useDataTable<AssignedArticle>({
    // The body draws its loading rows only while it has no rows: none while the flag is read, even with the
    // assignments already here.
    data: tableGrid.loading ? NO_ARTICLES : rows,
    columns: COLUMNS,
    getRowId,
    enableSorting: false,
  });

  return (
    <div className="flex flex-col gap-[var(--spacing-system-mf)]">
      <Input
        userValue
        placeholder="Search for Knowledge Article"
        value={search}
        onChange={event => setSearch(event.target.value)}
        startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
      />
      <DataTable table={table} layout={tableGrid.layout} settings={tableGrid.settings}>
        {/* The grid's results count sits above the table; the card header carries its own in `rightSlot`, which the
            grid header does not draw. */}
        {grid && (
          <DataTable.Meta>
            <DataTable.RowCount itemName="item" />
          </DataTable.Meta>
        )}
        {/* `loading`: what the body gets. A loading grid table names no column (the card header does not read it). */}
        <DataTable.Header rightSlot={<DataTable.RowCount itemName="item" />} loading={loading} />
        <DataTable.Body
          loading={loading}
          skeletonRows={ASSIGNED_ITEMS_SKELETON_ROWS}
          emptyState={oneLineEmptyState('No articles assigned.')}
          rowHref={rowHref}
        />
      </DataTable>
    </div>
  );
}
