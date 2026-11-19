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

interface ArchivedArticleDateCellProps {
  article: archivedArticleDateCell_article$key;
  /** The cell's one-line form in a grid table (`ItemTimestamp`). */
  grid?: boolean;
}

/** ARCHIVED column: when the article was archived. */
export function ArchivedArticleDateCell({ article, grid }: ArchivedArticleDateCellProps) {
  // A row still being read (a loading scope) has no fragment to read: the timestamp draws its bars.
  const data = useFragment(archivedArticleDateCellFragment, useLoadingScope() ? null : article);
  if (!data) return <ItemTimestamp value={null} grid={grid} />;
  const archivedAt = data.updatedAt ?? data.createdAt;
  return archivedAt ? <ItemTimestamp value={archivedAt} grid={grid} /> : null;
}
