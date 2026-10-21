'use client';

import { Tag, TagSkeleton, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
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
 * The article's tags, under its title. An untagged article draws nothing. Before the article answers (a loading
 * scope, or no article yet) the row draws its own loading state: a typical row of chips.
 */
export function ArticleDetailTags({ article }: { article: articleDetailTags_article$key | null }) {
  const loading = useLoadingScope();
  const data = useFragment(articleDetailTagsFragment, article);
  if (loading || !data) {
    return <ArticleDetailTagsSkeleton />;
  }
  if (data.tags.length === 0) {
    return null;
  }
  return (
    <div className={ROW_CLASS}>
      {data.tags.map(tag => (
        <Tag key={tag.id} label={tag.key} variant="outline" className="max-w-full" data-loading-item />
      ))}
    </div>
  );
}

function ArticleDetailTagsSkeleton() {
  return (
    <div className={ROW_CLASS}>
      {Array.from({ length: ARTICLE_TAGS_SKELETON_COUNT }, (_, index) => (
        <span key={index} data-loading-item>
          <TagSkeleton />
        </span>
      ))}
    </div>
  );
}
