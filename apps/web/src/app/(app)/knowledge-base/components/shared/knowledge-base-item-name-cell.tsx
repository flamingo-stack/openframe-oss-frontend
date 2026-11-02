'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { knowledgeBaseItemNameCell_item$key } from '@/__generated__/knowledgeBaseItemNameCell_item.graphql';
import { KnowledgeBaseItemType } from '@/generated/schema-enums';
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
  // A row still being read (a loading scope) has no fragment to read: the name draws its loading form.
  const data = useFragment(knowledgeBaseItemNameCellFragment, useLoadingScope() ? null : item);
  if (!data) return <KnowledgeBaseItemName type={KnowledgeBaseItemType.ARTICLE} name="" status={null} summary={null} />;
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
