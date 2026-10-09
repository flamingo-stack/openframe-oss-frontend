'use client';

import { BoxArchiveIcon, PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense, useState } from 'react';
import { TableSkeleton } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { routes } from '@/lib/routes';
import { NewFolderModal } from '../dialogs/new-folder-modal';
import { ROOT_FOLDER } from '../shared/folder-tree';
import { KNOWLEDGE_BASE_ITEM_TABLE_COLUMNS, KNOWLEDGE_BASE_PAGE_SIZE } from '../shared/knowledge-base-item-columns';
import { KnowledgeBaseSearchToolbar } from '../shared/knowledge-base-search-toolbar';
import { useTagSearchState } from '../shared/use-tag-search-state';
import { KnowledgeBaseFolderTitle } from './knowledge-base-folder-title';
import { KnowledgeBaseItemsTable } from './knowledge-base-items-table';
import { KnowledgeBaseListTitle } from './knowledge-base-list-title';

const ICON_CLASS = 'size-[var(--icon-size-icon-size)]';

/**
 * The header buttons. They depend on the route alone, so they are real from the
 * first paint — while a folder's name is still loading too.
 */
function pageActions(folderId: string | null, onNewFolder: () => void, emphasizeAddArticle: boolean) {
  const actions: PageActionButton[] = [
    {
      label: 'New Folder',
      onClick: onNewFolder,
      icon: <PlusCircleIcon size={24} className={`${ICON_CLASS} text-ods-text-secondary`} />,
      variant: 'outline',
    },
    {
      label: 'Add Article',
      href: folderId ? routes.knowledgeBase.new({ folderId }) : routes.knowledgeBase.new(),
      icon: (
        <PlusCircleIcon
          size={24}
          className={`${ICON_CLASS} ${emphasizeAddArticle ? 'text-ods-text-on-accent' : 'text-ods-text-secondary'}`}
        />
      ),
      variant: emphasizeAddArticle ? 'accent' : 'outline',
    },
  ];
  // The archive is one list for the whole knowledge base, so only the root links to it.
  if (folderId === null) {
    actions.unshift({
      label: 'Archive',
      href: routes.knowledgeBase.archive,
      icon: <BoxArchiveIcon className={`${ICON_CLASS} text-ods-text-secondary`} />,
      variant: 'outline',
    });
  }
  return actions;
}

interface KnowledgeBaseViewProps {
  /** The folder listed; null is the root. */
  folderId: string | null;
}

/**
 * `/knowledge-base` and `/knowledge-base/folders`: one level of the knowledge
 * base. Owns the URL state (search + tags), the sticky toolbar and the New Folder
 * dialog; the rows suspend below it.
 *
 * Not `PageLayout`: a folder's title is the folder record, so only the island
 * that reads it waits (canon `software-detail-view`).
 */
export function KnowledgeBaseView({ folderId }: KnowledgeBaseViewProps) {
  const filters = useTagSearchState();
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // Search and tags are deferred together, so `isPending` covers both.
  const {
    deferredFilters: deferredTagIds,
    deferredSearch,
    isPending,
  } = useDeferredQuery(filters.tagIds, filters.debouncedSearch);

  // An empty level accents Add Article: it is the one thing there is to do.
  const actions = pageActions(folderId, () => setIsNewFolderOpen(true), isEmpty);

  return (
    <div className="flex w-full flex-col">
      {folderId === null ? (
        <KnowledgeBaseListTitle title={ROOT_FOLDER.name} actions={actions} />
      ) : (
        <Suspense
          fallback={
            <KnowledgeBaseListTitle
              title={ROOT_FOLDER.name}
              loading
              backTo={routes.knowledgeBase.list}
              actions={actions}
            />
          }
        >
          <KnowledgeBaseFolderTitle folderId={folderId} actions={actions} />
        </Suspense>
      )}

      <div className="flex flex-col" style={containerStyle}>
        {/* Nothing on the level at all: the empty state stands alone, with nothing to search. */}
        {!isEmpty && (
          <KnowledgeBaseSearchToolbar
            toolbarRef={toolbarRef}
            placeholder="Search for Articles"
            parentId={folderId}
            filters={filters}
          />
        )}

        <Suspense
          fallback={
            <TableSkeleton
              columns={KNOWLEDGE_BASE_ITEM_TABLE_COLUMNS}
              rows={KNOWLEDGE_BASE_PAGE_SIZE}
              stickyHeaderOffset={stickyHeaderOffset}
            />
          }
        >
          <KnowledgeBaseItemsTable
            listing={{ parentId: folderId, search: deferredSearch, tagIds: deferredTagIds }}
            isPending={isPending}
            onEmptyChange={setIsEmpty}
            stickyHeaderOffset={stickyHeaderOffset}
          />
        </Suspense>
      </div>

      <NewFolderModal isOpen={isNewFolderOpen} onClose={() => setIsNewFolderOpen(false)} parentId={folderId} />
    </div>
  );
}
