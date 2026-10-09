'use client';

import { notFound } from 'next/navigation';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { articleDetailContentQuery as ArticleDetailContentQueryType } from '@/__generated__/articleDetailContentQuery.graphql';
import { CONTEXT_ENTITY_KIND } from '@/app/(app)/mingo/context/context-types';
import { useTrackOpenView } from '@/app/(app)/mingo/context/use-track-open-view';
import { useRetryKey } from '@/app/components/shared';
import { KnowledgeBaseItemType } from '@/generated/schema-enums';
import { decodeGlobalId } from '@/lib/relay-id';
import { ArticleDetail } from './article-detail';

/** `knowledgeBaseItem(id:)` is nullable: an unknown id resolves to null rather than throwing. */
const articleDetailContentQuery = graphql`
  query articleDetailContentQuery($id: ID!) {
    knowledgeBaseItem(id: $id) {
      type
      # What the page reports to Mingo as the open view.
      name
      ...articleDetail_article
    }
  }
`;

/** Everything on the article page that waits for the article. */
export function ArticleDetailContent({ articleId }: { articleId: string }) {
  const retryKey = useRetryKey();
  const { knowledgeBaseItem: item } = useLazyLoadQuery<ArticleDetailContentQueryType>(
    articleDetailContentQuery,
    { id: articleId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const article = item?.type === KnowledgeBaseItemType.ARTICLE ? item : null;

  // Registers the open article as the Mingo "open view". Mingo carries the RAW
  // database id — the route's is the Relay global id — and re-encodes it for
  // its own lookup.
  const articleDbId = decodeGlobalId(articleId)?.rawId ?? articleId;
  useTrackOpenView(
    article ? { type: CONTEXT_ENTITY_KIND.KB_ARTICLE, id: articleDbId, label: article.name || articleDbId } : null,
  );

  // An unknown id, or a folder's: there is no article to show.
  if (!article) {
    notFound();
  }

  return <ArticleDetail article={article} />;
}
