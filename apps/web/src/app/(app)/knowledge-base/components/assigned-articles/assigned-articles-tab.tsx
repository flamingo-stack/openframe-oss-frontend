'use client';

import { Filter02Icon, PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingWhen, TagSearchInput } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { SelectableTag } from '@/app/components/shared';
import { ResponsiveActionButton } from '@/app/components/shared/responsive-action-button';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { ASSIGNED_ITEMS_QUERY_KEY } from '@/components/assignments';
import { KnowledgeBaseTagsFilterModal } from '../shared/knowledge-base-tags-filter-modal';
import { AssignArticleModal } from './assign-article-modal';
import { AssignedArticlesTable } from './assigned-articles-table';
import type { AssignedArticlesTarget } from './assigned-articles-target';

const ICON_CLASS = 'size-[var(--icon-size-icon-size)] text-ods-text-secondary';

interface AssignedArticlesTabProps {
  /**
   * Whose articles the tab lists; null while the page has not read it yet: the tab is drawn in a loading scope (its
   * table its own loading state, no query run), with Assign real and inert.
   */
  target: AssignedArticlesTarget | null;
}

/**
 * The Assigned Articles tab of a customer and of a device: the knowledge base
 * articles assigned to it, searchable and filterable by tag, plus the Assign
 * Article modal and an Unassign per row.
 *
 * Search and tags are tab-local state, not URL params: the tab shares its page's
 * query string with every sibling tab, and a `search` left behind would leak into
 * whichever tab reads one next.
 */
export function AssignedArticlesTab({ target }: AssignedArticlesTabProps) {
  const queryClient = useQueryClient();
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedTags, setSelectedTags] = useState<SelectableTag[]>([]);
  const [tagIds, setTagIds] = useState<readonly string[]>([]);
  const { deferredFilters: deferredTagIds, deferredSearch, isPending } = useDeferredQuery(tagIds, debouncedSearch);

  const [isEmpty, setIsEmpty] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  // Bumped after an assign or unassign: the list and the tags on offer are asked for again.
  const [refreshKey, setRefreshKey] = useState(0);

  const applyTags = (tags: SelectableTag[]) => {
    setSelectedTags(tags);
    setTagIds(tags.map(tag => tag.id));
  };

  const handleChanged = () => {
    setRefreshKey(key => key + 1);
    // The article page lists its assignees from `assignedItems` (react-query).
    void queryClient.invalidateQueries({ queryKey: ASSIGNED_ITEMS_QUERY_KEY });
  };

  const rows = (
    <AssignedArticlesTable
      target={target}
      listing={{ search: deferredSearch, tagIds: deferredTagIds }}
      isPending={isPending}
      refreshKey={refreshKey}
      onChanged={handleChanged}
      onEmptyChange={setIsEmpty}
      stickyHeaderOffset={stickyHeaderOffset}
    />
  );
  // Suspends on the tags; while they load the modal is drawn in a loading scope, its own loading state.
  const tagsModal = (
    <KnowledgeBaseTagsFilterModal
      isOpen={isTagsOpen}
      onClose={() => setIsTagsOpen(false)}
      parentId={null}
      archived={false}
      assignedTo={target}
      refreshKey={refreshKey}
      selectedIds={tagIds}
      onApply={applyTags}
    />
  );

  const pending = target == null;

  return (
    <LoadingWhen loading={pending}>
      <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
        <div className="flex flex-wrap items-center justify-between gap-[var(--spacing-system-m)]">
          <h2 className="text-ods-text-primary text-h2">Assigned Articles</h2>
          <ResponsiveActionButton
            label="Assign Article"
            icon={<PlusCircleIcon className={ICON_CLASS} />}
            onClick={() => setIsAssignOpen(true)}
            disabled={pending}
          />
        </div>

        <div className="flex flex-col">
          {/* Nothing assigned at all: the empty state stands alone, with nothing to search. */}
          {!isEmpty && (
            <div
              ref={toolbarRef}
              className="sticky top-0 z-20 -mt-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] bg-ods-bg pb-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]"
            >
              <div className="min-w-0 flex-1">
                <TagSearchInput<string>
                  tags={selectedTags.map(tag => ({ label: tag.key, value: tag.id }))}
                  searchValue={search}
                  onSearchChange={setSearch}
                  onTagRemove={id => applyTags(selectedTags.filter(tag => tag.id !== id))}
                  onClearAll={() => {
                    setSearch('');
                    applyTags([]);
                  }}
                  placeholder="Search for Articles"
                  addMorePlaceholder="Search for Articles"
                />
              </div>
              <ResponsiveActionButton
                label="Article Tags"
                icon={<Filter02Icon className={ICON_CLASS} />}
                onClick={() => setIsTagsOpen(true)}
              />
            </div>
          )}

          {/* The rows: the table places its own boundary and, before they answer, draws its own loading state. */}
          {rows}
        </div>

        {/* Beside the toolbar, not inside it: the bar is a stacking context (`sticky` + `z-20`),
          and a modal inside it could never rise above the app header. */}
        {/* The dialogs act on the target: mounted once it is known. */}
        {target && (
          <>
            {tagsModal}
            <AssignArticleModal
              target={target}
              isOpen={isAssignOpen}
              onClose={() => setIsAssignOpen(false)}
              onAssigned={handleChanged}
            />
          </>
        )}
      </div>
    </LoadingWhen>
  );
}
