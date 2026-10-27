'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { FilterModal, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { NO_ITEMS, type SelectableTag } from '@/app/components/shared';
import type { AssignedArticlesTarget } from '../assigned-articles/assigned-articles-target';
import { useKnowledgeBaseTags } from './use-knowledge-base-tags';

// Knowledge base tags are flat (no key:value), so the modal has one group.
const TAGS_GROUP_ID = 'tags';

interface KnowledgeBaseTagsFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string | null;
  archived: boolean;
  /** Offer the tags of the articles assigned to this customer or device instead. */
  assignedTo?: AssignedArticlesTarget | null;
  /** Bumped after an assign or unassign, which can change the tags on offer. */
  refreshKey?: number;
  /** The applied tag ids — ticked when the modal opens. */
  selectedIds: ReadonlyArray<string>;
  /** Apply hands back the whole new selection; it replaces the current one. */
  onApply: (tags: SelectableTag[]) => void;
}

/**
 * The tag filter as a modal — a phone's, where the tag row has no room, and the
 * Assigned Articles tab's at every width: every tag as a checkbox. Suspends on the tags; in a loading scope (its
 * Suspense fallback) the modal draws its own loading state and reads nothing.
 */
export function KnowledgeBaseTagsFilterModal(props: KnowledgeBaseTagsFilterModalProps) {
  return (
    <LoadingSuspense label="Loading tags">
      <KnowledgeBaseTagsFilterModalReader {...props} />
    </LoadingSuspense>
  );
}

/** In a loading scope (its boundary's fallback, or an outer loading state) it draws itself with no data and runs no read. */
function KnowledgeBaseTagsFilterModalReader(props: KnowledgeBaseTagsFilterModalProps) {
  if (useLoadingScope()) {
    return <TagsFilterModalView {...props} tags={NO_ITEMS} loading />;
  }
  return <KnowledgeBaseTagsFilterModalQuery {...props} />;
}

function KnowledgeBaseTagsFilterModalQuery(props: KnowledgeBaseTagsFilterModalProps) {
  const { parentId, archived, assignedTo = null, refreshKey = 0 } = props;
  const tags = useKnowledgeBaseTags(parentId, archived, assignedTo, refreshKey);
  return <TagsFilterModalView {...props} tags={tags} loading={false} />;
}

/** Whose articles had no tags to offer, for the modal's empty state. */
function noTagsDescription({
  parentId,
  archived,
  assignedTo,
}: Pick<KnowledgeBaseTagsFilterModalProps, 'parentId' | 'archived' | 'assignedTo'>): string {
  if (assignedTo) return 'No assigned article has tags.';
  if (archived) return 'No archived article has tags.';
  if (parentId) return 'No article in this folder has tags.';
  return 'No article in the knowledge base has tags.';
}

function TagsFilterModalView({
  isOpen,
  onClose,
  parentId,
  archived,
  assignedTo,
  selectedIds,
  onApply,
  tags,
  loading,
}: KnowledgeBaseTagsFilterModalProps & { tags: SelectableTag[]; loading: boolean }) {
  const handleFilterChange = (filters: Record<string, string[]>) => {
    const picked = new Set(filters[TAGS_GROUP_ID] ?? []);
    onApply(tags.filter(tag => picked.has(tag.id)));
  };

  return (
    <FilterModal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter by Tags"
      // No group at all when there are no tags: `FilterModal` skips a group with no options
      // but draws its empty state only when it has no groups, so an empty group left a blank body.
      filterGroups={
        tags.length > 0
          ? [{ id: TAGS_GROUP_ID, title: 'Tags', options: tags.map(tag => ({ id: tag.id, label: tag.key })) }]
          : []
      }
      emptyStateTitle="No tags to filter by"
      emptyStateDescription={noTagsDescription({ parentId, archived, assignedTo })}
      // `FilterModal` re-seeds its checkboxes from this each time it opens.
      currentFilters={{ [TAGS_GROUP_ID]: [...selectedIds] }}
      onFilterChange={handleFilterChange}
      isLoading={loading}
      applyButtonText="Apply"
      resetButtonText="Reset"
      className="max-w-[600px]"
    />
  );
}
