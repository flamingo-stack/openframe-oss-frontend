import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { KNOWLEDGE_BASE_ITEM_COLUMNS } from '../shared/knowledge-base-item-columns';

/** The archive's date column: the same slot as the listing's CREATED, showing when the article was archived. */
export const ARCHIVED_COLUMN = {
  ...KNOWLEDGE_BASE_ITEM_COLUMNS.created,
  id: 'archived',
  header: 'Archived',
} satisfies TableSkeletonColumn;
