'use client';

import { graphql, useFragment } from 'react-relay';
import type { articleDetail_article$key } from '@/__generated__/articleDetail_article.graphql';
import { AssignedItemsView } from '@/components/assignments';
import { ArticleDetailAttachments } from './article-detail-attachments';
import { ArticleDetailBody } from './article-detail-body';
import { ArticleDetailSummary } from './article-detail-summary';
import { ArticleDetailTags } from './article-detail-tags';
import { ArticleDetailTitle } from './article-detail-title';
import { useArticleDetailActions } from './use-article-detail-actions';

const articleDetailFragment = graphql`
  fragment articleDetail_article on KnowledgeBaseItem {
    id
    name
    ...useArticleDetailActions_article
    ...articleDetailTags_article
    ...articleDetailSummary_article
    ...articleDetailBody_article
    ...articleDetailAttachments_article
  }
`;

/** An article's page: the title with its actions, then the article top to bottom. */
export function ArticleDetail({ article }: { article: articleDetail_article$key }) {
  const data = useFragment(articleDetailFragment, article);
  const { actions, menuActions, dialogs } = useArticleDetailActions(data);

  return (
    <>
      <ArticleDetailTitle title={data.name} actions={actions} menuActions={menuActions} />
      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
        <ArticleDetailTags article={data} />
        <ArticleDetailSummary article={data} />
        <ArticleDetailBody article={data} />
        <ArticleDetailAttachments article={data} />
        {/* What the article is assigned to is its own request (assignments are not on Relay). */}
        <AssignedItemsView itemId={data.id} itemType="KNOWLEDGE_ARTICLE" />
      </div>
      {dialogs}
    </>
  );
}
