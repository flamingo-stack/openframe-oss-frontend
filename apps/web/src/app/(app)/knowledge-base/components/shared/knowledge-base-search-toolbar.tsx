'use client';

import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, TagSearchInput } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense, useState } from 'react';
import { SelectableTagsRowSkeleton } from '@/app/components/shared';
import { KnowledgeBaseTagsFilterModal } from './knowledge-base-tags-filter-modal';
import { KnowledgeBaseTagsRow } from './knowledge-base-tags-row';
import type { TagSearchState } from './use-tag-search-state';

interface KnowledgeBaseSearchToolbarProps {
  /** From `useStickyToolbar` — the table header pins right under this bar. */
  toolbarRef: (node: HTMLDivElement | null) => void;
  placeholder: string;
  /** The folder whose tags are offered; null is the whole knowledge base. */
  parentId: string | null;
  /** Offer the tags of the archived articles instead. */
  archived?: boolean;
  filters: TagSearchState;
}

/**
 * The sticky search bar of a knowledge base list: the search box with the picked
 * tags, and the tags still on offer — a row of chips from `md` up, a filter
 * button opening a modal below it. The breakpoint is CSS: a media-query hook has
 * no answer on the first render.
 */
export function KnowledgeBaseSearchToolbar({
  toolbarRef,
  placeholder,
  parentId,
  archived = false,
  filters,
}: KnowledgeBaseSearchToolbarProps) {
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);

  return (
    <>
      <div
        ref={toolbarRef}
        className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] flex flex-col gap-[var(--spacing-system-xxs)] bg-ods-bg px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]"
      >
        <div className="flex items-center gap-[var(--spacing-system-m)]">
          <div className="min-w-0 flex-1">
            <TagSearchInput<string>
              tags={filters.tagSearchOptions}
              searchValue={filters.search}
              onSearchChange={filters.setSearch}
              onTagRemove={filters.removeTag}
              onClearAll={filters.clearAll}
              placeholder={placeholder}
              addMorePlaceholder={placeholder}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsTagsModalOpen(true)}
            aria-label="Filter by tags"
            leftIcon={<Filter02Icon />}
            className="md:hidden"
          />
        </div>

        {/* `contents`, so a folder with no tags leaves no empty box — and no gap — under the search. */}
        <div className="hidden md:contents">
          <Suspense fallback={<SelectableTagsRowSkeleton />}>
            <KnowledgeBaseTagsRow
              parentId={parentId}
              archived={archived}
              selectedIds={filters.tagIds}
              onAdd={filters.addTag}
            />
          </Suspense>
        </div>
      </div>

      {/* Beside the bar, not inside it: the bar is a stacking context (`sticky` + `z-20`), and a
          modal inside it could never rise above the app header. */}
      <Suspense fallback={null}>
        <KnowledgeBaseTagsFilterModal
          isOpen={isTagsModalOpen}
          onClose={() => setIsTagsModalOpen(false)}
          parentId={parentId}
          archived={archived}
          selectedIds={filters.tagIds}
          onApply={filters.setTags}
        />
      </Suspense>
    </>
  );
}
