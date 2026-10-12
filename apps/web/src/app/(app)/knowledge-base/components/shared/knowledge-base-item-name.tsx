'use client';

import { Tag, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { knowledgeBaseItemNameCell_item$data } from '@/__generated__/knowledgeBaseItemNameCell_item.graphql';
import { KnowledgeBaseArticleStatus, KnowledgeBaseItemType } from '@/generated/schema-enums';
import { ARTICLE_STATUS_VARIANT } from './article-status';
import { KB_ITEM_ICON } from './knowledge-base-item-icon';

/** The NAME column's values — typed off the cell's fragment, so a list that is not on Relay is checked against it. */
export type KnowledgeBaseItemNameProps = Omit<knowledgeBaseItemNameCell_item$data, ' $fragmentType'> & {
  /** The folder the row is in — for a list whose rows come from different folders. */
  folder?: string;
};

/**
 * NAME column: the glyph, the name, the status of an article that is not live,
 * and under them the folder (where the list says it) and an article's summary.
 */
export function KnowledgeBaseItemName({ type, name, status, summary, folder }: KnowledgeBaseItemNameProps) {
  const isFolder = type === KnowledgeBaseItemType.FOLDER;
  const caption = [folder, isFolder ? null : summary].filter(Boolean).join(' · ');
  const Icon = KB_ITEM_ICON[isFolder ? KnowledgeBaseItemType.FOLDER : KnowledgeBaseItemType.ARTICLE];
  const flag =
    status === KnowledgeBaseArticleStatus.DRAFT || status === KnowledgeBaseArticleStatus.ARCHIVED ? status : null;

  return (
    <div className="flex h-20 w-full items-center gap-[var(--spacing-system-m)]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-ods-border">
        <Icon size={16} className="shrink-0 text-ods-text-secondary" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
          {/* The tooltip trigger is the flex item, so it is what has to be allowed to shrink. */}
          <div className="min-w-0">
            <TruncateText>{name}</TruncateText>
          </div>
          {flag && <Tag variant={ARTICLE_STATUS_VARIANT[flag]} label={flag} className="shrink-0" />}
        </div>
        {caption && (
          <TruncateText variant="h6" tone="secondary">
            {caption}
          </TruncateText>
        )}
      </div>
    </div>
  );
}
