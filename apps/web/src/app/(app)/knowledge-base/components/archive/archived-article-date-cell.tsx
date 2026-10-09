'use client';

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
  const data = useFragment(archivedArticleDateCellFragment, article);
  const archivedAt = data.updatedAt ?? data.createdAt;
  return archivedAt ? <ItemTimestamp value={archivedAt} /> : null;
}
