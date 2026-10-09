'use client';

import { notFound } from 'next/navigation';
import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { articleRecordLoaderQuery as ArticleRecordLoaderQueryType } from '@/__generated__/articleRecordLoaderQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { KnowledgeBaseItemType } from '@/generated/schema-enums';
import { type ArticleFormRecord, readArticleFormRecord } from './article-form-record';

const articleRecordLoaderQuery = graphql`
  query articleRecordLoaderQuery($id: ID!) {
    knowledgeBaseItem(id: $id) {
      type
      ...articleFormRecord_article
    }
  }
`;

interface ArticleRecordLoaderProps {
  articleId: string;
  onResolved: (record: ArticleFormRecord) => void;
}

/**
 * The Edit page's data island; it renders nothing. It reads the article and hands
 * it up, where the owner of `useForm` seeds the form (`useSeedForm` — the write
 * cannot happen here).
 */
export function ArticleRecordLoader({ articleId, onResolved }: ArticleRecordLoaderProps) {
  const retryKey = useRetryKey();
  const { knowledgeBaseItem: item } = useLazyLoadQuery<ArticleRecordLoaderQueryType>(
    articleRecordLoaderQuery,
    { id: articleId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const article = item?.type === KnowledgeBaseItemType.ARTICLE ? item : null;

  // Identity matters: `useSeedForm` seeds once per values object, so it changes only with the record.
  const record = useMemo(() => (article ? readArticleFormRecord(article) : null), [article]);

  // Layout effect: the page seeds and unlocks the fields before the paint when the article is cached.
  useLayoutEffect(() => {
    if (record) onResolved(record);
  }, [record, onResolved]);

  // An unknown id, or a folder's: there is no article to edit.
  if (!article) {
    notFound();
  }

  return null;
}
