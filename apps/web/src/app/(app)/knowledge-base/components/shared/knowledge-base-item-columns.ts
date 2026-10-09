import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout of the knowledge base lists, shared by the live tables and their
 * skeletons — see `table-column-layout.ts` for why this module is data-only.
 */
export const KNOWLEDGE_BASE_ITEM_COLUMNS = {
  name: { id: 'name', header: 'Name', width: 'flex-1 min-w-0' },
  created: { id: 'created', header: 'Created', width: 'w-[140px]', hideAt: 'lg' },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/** `/knowledge-base` and a folder's page — render order for the live table and its skeleton. */
export const KNOWLEDGE_BASE_ITEM_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  KNOWLEDGE_BASE_ITEM_COLUMNS.name,
  KNOWLEDGE_BASE_ITEM_COLUMNS.created,
  KNOWLEDGE_BASE_ITEM_COLUMNS.actions,
  KNOWLEDGE_BASE_ITEM_COLUMNS.open,
];

export const KNOWLEDGE_BASE_PAGE_SIZE = 20;
