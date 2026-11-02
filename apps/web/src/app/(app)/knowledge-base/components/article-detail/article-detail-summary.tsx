'use client';

import {
  Card,
  SquareAvatar,
  Tag,
  TruncateText,
  LoadingWhen,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { articleDetailSummary_article$key } from '@/__generated__/articleDetailSummary_article.graphql';
import { DeletedUserAvatar, isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { InfoCell } from '@/app/components/shared/info-cell';
import { formatDate } from '@/lib/format-date';
import { getFullImageUrl } from '@/lib/image-url';
import { ARTICLE_STATUS_VARIANT, toArticleStatus } from '../shared/article-status';

const articleDetailSummaryFragment = graphql`
  fragment articleDetailSummary_article on KnowledgeBaseItem {
    status
    createdAt
    updatedAt
    author {
      firstName
      lastName
      email
      status
      image {
        imageUrl
        hash
      }
    }
  }
`;

// The cells' labels: static copy, so the loading card draws them for real.
const LABELS = { author: 'Author', updated: 'Updated', status: 'Status' } as const;

const CELL_CLASSES = 'h-20';

/** The card's frame — three cells in a row on a wide screen, two over one below `lg`. */
function SummaryCard({ author, updated, status }: { author: ReactNode; updated: ReactNode; status: ReactNode }) {
  return (
    <Card className="border-ods-border px-[var(--spacing-system-mf)] py-0">
      <div className="grid grid-cols-2 gap-x-[var(--spacing-system-mf)] content-lg:grid-cols-3">
        {author}
        {updated}
        <div
          className="col-span-2 -mx-[var(--spacing-system-mf)] border-t border-ods-border content-lg:hidden"
          aria-hidden
        />
        {status}
      </div>
    </Card>
  );
}

/** The author's cell: the avatar beside the name, then the same `InfoCell` as its neighbours (its own loading bar). */
function AuthorCell({ avatar, name }: { avatar: ReactNode; name: ReactNode }) {
  return (
    <div className={`flex min-w-0 items-center gap-[var(--spacing-system-xsf)] ${CELL_CLASSES}`}>
      {avatar}
      <InfoCell label={LABELS.author} value={name} />
    </div>
  );
}

/**
 * Who wrote the article, when it last changed and whether it is live. Before the article answers (a loading scope,
 * or no article yet) the card renders itself in a scope: every cell draws its label for real and a bar for its value,
 * and the avatar draws its own shape.
 */
export function ArticleDetailSummary({ article }: { article: articleDetailSummary_article$key | null }) {
  const data = useFragment(articleDetailSummaryFragment, article);
  const author = data?.author;

  const fullName = [author?.firstName, author?.lastName].filter(Boolean).join(' ');
  const authorName = fullName || author?.email || null;
  // A deleted account keeps its name here, drawn as deleted.
  const isDeletedAuthor = isDeletedUserStatus(author?.status);
  const articleStatus = toArticleStatus(data?.status);

  return (
    <LoadingWhen loading={!data}>
      <SummaryCard
        author={
          <AuthorCell
            avatar={
              isDeletedAuthor ? (
                <DeletedUserAvatar size="md" />
              ) : (
                <SquareAvatar
                  src={getFullImageUrl(author?.image?.imageUrl, author?.image?.hash)}
                  fallback={authorName ?? 'A'}
                  alt={authorName ?? 'Author'}
                  size="md"
                  variant="round"
                />
              )
            }
            name={
              <TruncateText className={isDeletedAuthor ? 'text-ods-error' : undefined}>
                {authorName ?? 'Unknown'}
              </TruncateText>
            }
          />
        }
        updated={
          <InfoCell
            className={CELL_CLASSES}
            label={LABELS.updated}
            value={data ? formatDate(data.updatedAt ?? data.createdAt) : null}
            skeletonWidth="w-24"
          />
        }
        status={
          <InfoCell
            className={CELL_CLASSES}
            label={LABELS.status}
            // No label while the article loads: the tag draws its own skeleton in the cell's scope.
            value={<Tag variant={ARTICLE_STATUS_VARIANT[articleStatus]} label={data ? articleStatus : null} />}
          />
        }
      />
    </LoadingWhen>
  );
}
