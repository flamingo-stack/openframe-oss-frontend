'use client';

import {
  LoadingScope,
  type PageActionButton,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { articleDetail_article$key } from '@/__generated__/articleDetail_article.graphql';
import { AssignedItemsView } from '@/components/assignments';
import { ArticleDetailAttachments } from './article-detail-attachments';
import { ArticleDetailBody } from './article-detail-body';
import { ArticleDetailSummary } from './article-detail-summary';
import { ArticleDetailTags } from './article-detail-tags';
import { ArticleDetailTitle } from './article-detail-title';
import { editArticleAction, useArticleDetailActions } from './use-article-detail-actions';

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

/** The entry every status but "archived" settles into, drawn inert while the article loads. */
const LOADING_ACTIONS: PageActionButton[] = [editArticleAction()];

const BODY_CLASS = 'flex flex-1 flex-col gap-[var(--spacing-system-l)]';

/**
 * An article's page: the title with its actions, then the article top to bottom. In a loading scope (the page's
 * Suspense fallback) the title, the tags, the card, the text and the assigned items draw their own loading states;
 * attachments are only some articles' (marked optional) and sit below the text, so they are left out until the article
 * answers.
 */
export function ArticleDetail({ article }: { article: articleDetail_article$key | null }) {
  if (useLoadingScope() || !article) {
    return (
      <>
        <ArticleDetailTitle title="Article" loading actions={LOADING_ACTIONS} loadingActions />
        <LoadingScope className={BODY_CLASS}>
          <ArticleDetailTags article={null} />
          <ArticleDetailSummary article={null} />
          <ArticleDetailBody article={null} />
          {/* In the scope the view reads nothing: no item id yet. */}
          <AssignedItemsView itemId="" itemType="KNOWLEDGE_ARTICLE" />
        </LoadingScope>
      </>
    );
  }
  return <LoadedArticleDetail article={article} />;
}

function LoadedArticleDetail({ article }: { article: articleDetail_article$key }) {
  const data = useFragment(articleDetailFragment, article);
  const { actions, menuActions, dialogs } = useArticleDetailActions(data);

  return (
    <>
      <ArticleDetailTitle title={data.name} actions={actions} menuActions={menuActions} />
      <div className={BODY_CLASS}>
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
