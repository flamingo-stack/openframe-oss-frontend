'use client';

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

/** CREATED column: when an article was written. A folder's row leaves it empty. */
export function KnowledgeBaseItemCreatedCell({ item }: { item: knowledgeBaseItemCreatedCell_item$key }) {
  const data = useFragment(knowledgeBaseItemCreatedCellFragment, item);
  if (data.type !== KnowledgeBaseItemType.ARTICLE || !data.createdAt) {
    return null;
  }
  return <ItemTimestamp value={data.createdAt} />;
}
