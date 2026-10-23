'use client';

import { LoadingItems, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { articleDetailTags_article$key } from '@/__generated__/articleDetailTags_article.graphql';

const articleDetailTagsFragment = graphql`
  fragment articleDetailTags_article on KnowledgeBaseItem {
    tags {
      id
      key
    }
  }
`;

/** How many chips the row draws before the article answers: a typical article's tag count. */
const ARTICLE_TAGS_SKELETON_COUNT = 3;

/** The row keeps one chip's height (a `Tag` is h-8) even with no tag, so the title block never moves when it lands. */
const ROW_CLASS = 'flex min-h-8 flex-wrap gap-[var(--spacing-system-xsf)]';

/**
 * The article's tags, under its title. The row is always drawn: an untagged article keeps an empty row of one chip's
 * height. Before the article answers (a loading scope, or no article yet) it draws a typical row of chip shapes.
 */
export function ArticleDetailTags({ article }: { article: articleDetailTags_article$key | null }) {
  const data = useFragment(articleDetailTagsFragment, article);
  const loading = useLoadingScope();
  return (
    <div className={ROW_CLASS}>
      {loading || !data ? (
        <LoadingItems count={ARTICLE_TAGS_SKELETON_COUNT}>
          {() => <Tag label="" loading data-loading-item />}
        </LoadingItems>
      ) : (
        data.tags.map(tag => (
          <Tag key={tag.id} label={tag.key} variant="outline" className="max-w-full" data-loading-item />
        ))
      )}
    </div>
  );
}
