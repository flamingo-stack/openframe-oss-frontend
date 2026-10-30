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

const ROW_CLASS = 'flex flex-wrap gap-[var(--spacing-system-xsf)]';

/**
 * The article's tags, under its title. Before the article answers (a loading scope, or no article yet) it draws a
 * typical row of chip shapes; an untagged article has no row.
 */
export function ArticleDetailTags({ article }: { article: articleDetailTags_article$key | null }) {
  const data = useFragment(articleDetailTagsFragment, article);
  if (useLoadingScope() || !data) {
    return (
      <div className={ROW_CLASS}>
        <LoadingItems count={ARTICLE_TAGS_SKELETON_COUNT}>
          {() => <Tag label="" loading data-loading-item />}
        </LoadingItems>
      </div>
    );
  }
  if (data.tags.length === 0) return null;
  return (
    <div className={ROW_CLASS}>
      {data.tags.map(tag => (
        <Tag key={tag.id} label={tag.key} variant="outline" className="max-w-full" data-loading-item />
      ))}
    </div>
  );
}
