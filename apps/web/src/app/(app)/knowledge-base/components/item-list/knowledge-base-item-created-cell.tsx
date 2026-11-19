'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { knowledgeBaseItemCreatedCell_item$key } from '@/__generated__/knowledgeBaseItemCreatedCell_item.graphql';
import { KnowledgeBaseItemType } from '@/generated/schema-enums';
import { ItemTimestamp } from '../shared/item-timestamp';

const knowledgeBaseItemCreatedCellFragment = graphql`
  fragment knowledgeBaseItemCreatedCell_item on KnowledgeBaseItem {
    type
    createdAt
  }
`;

interface KnowledgeBaseItemCreatedCellProps {
  item: knowledgeBaseItemCreatedCell_item$key;
  /** The cell's one-line form in a grid table (`ItemTimestamp`). */
  grid?: boolean;
}

/** CREATED column: when an article was written. A folder's row leaves it empty. */
export function KnowledgeBaseItemCreatedCell({ item, grid }: KnowledgeBaseItemCreatedCellProps) {
  // A row still being read (a loading scope) has no fragment to read: the timestamp draws its bars.
  const data = useFragment(knowledgeBaseItemCreatedCellFragment, useLoadingScope() ? null : item);
  if (!data) return <ItemTimestamp value={null} grid={grid} />;
  if (data.type !== KnowledgeBaseItemType.ARTICLE || !data.createdAt) {
    return null;
  }
  return <ItemTimestamp value={data.createdAt} grid={grid} />;
}
