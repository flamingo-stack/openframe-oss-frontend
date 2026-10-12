'use client';

import { graphql, useFragment } from 'react-relay';
import type { knowledgeBaseItemNameCell_item$key } from '@/__generated__/knowledgeBaseItemNameCell_item.graphql';
import { KnowledgeBaseItemName } from './knowledge-base-item-name';

const knowledgeBaseItemNameCellFragment = graphql`
  fragment knowledgeBaseItemNameCell_item on KnowledgeBaseItem {
    type
    name
    status
    summary
  }
`;

interface KnowledgeBaseItemNameCellProps {
  item: knowledgeBaseItemNameCell_item$key;
  /** The folder the row is in — for a list whose rows come from different folders. */
  folder?: string;
}

/** NAME column of the knowledge base lists. */
export function KnowledgeBaseItemNameCell({ item, folder }: KnowledgeBaseItemNameCellProps) {
  const data = useFragment(knowledgeBaseItemNameCellFragment, item);
  return (
    <KnowledgeBaseItemName
      type={data.type}
      name={data.name}
      status={data.status}
      summary={data.summary}
      folder={folder}
    />
  );
}
