'use client';

import { FilterModal } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { SelectableTag } from '@/app/components/shared';
import { useKnowledgeBaseTags } from './use-knowledge-base-tags';

// Knowledge base tags are flat (no key:value), so the modal has one group.
const TAGS_GROUP_ID = 'tags';

interface KnowledgeBaseTagsFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string | null;
  archived: boolean;
  /** The applied tag ids — ticked when the modal opens. */
  selectedIds: ReadonlyArray<string>;
  /** Apply hands back the whole new selection; it replaces the current one. */
  onApply: (tags: SelectableTag[]) => void;
}

/**
 * The tag filter of a phone, where the tag row has no room: every tag as a
 * checkbox. Suspends on the tags.
 */
export function KnowledgeBaseTagsFilterModal({
  isOpen,
  onClose,
  parentId,
  archived,
  selectedIds,
  onApply,
}: KnowledgeBaseTagsFilterModalProps) {
  const tags = useKnowledgeBaseTags(parentId, archived);

  const handleFilterChange = (filters: Record<string, string[]>) => {
    const picked = new Set(filters[TAGS_GROUP_ID] ?? []);
    onApply(tags.filter(tag => picked.has(tag.id)));
  };

  return (
    <FilterModal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter by Tags"
      filterGroups={[{ id: TAGS_GROUP_ID, title: 'Tags', options: tags.map(tag => ({ id: tag.id, label: tag.key })) }]}
      // `FilterModal` re-seeds its checkboxes from this each time it opens.
      currentFilters={{ [TAGS_GROUP_ID]: [...selectedIds] }}
      onFilterChange={handleFilterChange}
      applyButtonText="Apply"
      resetButtonText="Reset"
      className="max-w-[600px]"
    />
  );
}
