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
import { KNOWLEDGE_BASE_ITEM_COLUMNS } from '@/app/(app)/knowledge-base/components/shared/knowledge-base-item-columns';
import {
  KnowledgeBaseItemName,
  type KnowledgeBaseItemNameProps,
} from '@/app/(app)/knowledge-base/components/shared/knowledge-base-item-name';
import { OpenItemButton } from '@/app/(app)/knowledge-base/components/shared/open-item-button';
import { liveColumnMeta } from '@/app/components/shared';
import { routes } from '@/lib/routes';

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
    meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.name),
  },
  {
    id: KNOWLEDGE_BASE_ITEM_COLUMNS.created.id,
    header: KNOWLEDGE_BASE_ITEM_COLUMNS.created.header,
    cell: ({ row }: { row: Row<AssignedArticle> }) =>
      row.original.createdAt ? <ItemTimestamp value={row.original.createdAt} /> : null,
    enableSorting: false,
    meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.created),
  },
  {
    id: KNOWLEDGE_BASE_ITEM_COLUMNS.open.id,
    cell: ({ row }: { row: Row<AssignedArticle> }) => <OpenItemButton href={rowHref(row.original)} />,
    enableSorting: false,
    meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.open),
  },
];

interface KnowledgeBaseAssignedTableProps {
  articles: AssignedArticle[];
  isLoading?: boolean;
}

export function KnowledgeBaseAssignedTable({ articles, isLoading }: KnowledgeBaseAssignedTableProps) {
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
    data: rows,
    columns: COLUMNS,
    getRowId,
    enableSorting: false,
  });

  return (
    <div className="flex flex-col gap-[var(--spacing-system-mf)]">
      <Input
        placeholder="Search for Knowledge Article"
        value={search}
        onChange={event => setSearch(event.target.value)}
        startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
      />
      <DataTable table={table}>
        <DataTable.Header rightSlot={<DataTable.RowCount itemName="item" />} />
        <DataTable.Body
          loading={isLoading}
          skeletonRows={3}
          emptyState={{ title: 'No articles assigned.' }}
          rowHref={rowHref}
        />
      </DataTable>
    </div>
  );
}
