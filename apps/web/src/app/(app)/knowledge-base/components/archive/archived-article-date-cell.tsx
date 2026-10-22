'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { archivedArticleDateCell_article$key } from '@/__generated__/archivedArticleDateCell_article.graphql';
import { ItemTimestamp } from '../shared/item-timestamp';

// Archiving is the article's last change, so `updatedAt` is when it happened.
const archivedArticleDateCellFragment = graphql`
  fragment archivedArticleDateCell_article on KnowledgeBaseItem {
    updatedAt
    createdAt
  }
`;

/** ARCHIVED column: when the article was archived. */
export function ArchivedArticleDateCell({ article }: { article: archivedArticleDateCell_article$key }) {
  // A row still being read (a loading scope) has no fragment to read: the timestamp draws its bars.
  const data = useFragment(archivedArticleDateCellFragment, useLoadingScope() ? null : article);
  if (!data) return <ItemTimestamp value={null} />;
  const archivedAt = data.updatedAt ?? data.createdAt;
  return archivedAt ? <ItemTimestamp value={archivedAt} /> : null;
}
