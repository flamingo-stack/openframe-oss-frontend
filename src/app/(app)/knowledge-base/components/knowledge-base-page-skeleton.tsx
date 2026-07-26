'use client';

import { BoxArchiveIcon, PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SearchBarSkeleton, SelectableTagsRowSkeleton } from '@/app/components/shared';
import { KnowledgeBaseTableSkeleton } from './knowledge-base-table';

/**
 * Route-level skeleton for `/knowledge-base` — the same chrome
 * `KnowledgeBaseBody` renders while its Relay query is in flight (header +
 * search + tags row + `KnowledgeBaseTableSkeleton`), but without mounting the
 * tags query: the app shell renders this before the session is confirmed, so it
 * must not issue requests.
 */

const ICON_CLASS = 'size-[var(--icon-size-icon-size)] text-ods-text-secondary';

const ACTIONS: PageActionButton[] = [
  { label: 'Archive', variant: 'outline', disabled: true, icon: <BoxArchiveIcon className={ICON_CLASS} /> },
  {
    label: 'New Folder',
    variant: 'outline',
    disabled: true,
    icon: <PlusCircleIcon size={24} className={ICON_CLASS} />,
  },
  {
    label: 'Add Article',
    variant: 'outline',
    disabled: true,
    icon: <PlusCircleIcon size={24} className={ICON_CLASS} />,
  },
];

export function KnowledgeBasePageSkeleton() {
  return (
    <PageLayout
      title="Knowledge Base"
      actions={ACTIONS}
      actionsVariant="menu-primary"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <SearchBarSkeleton />
        <SelectableTagsRowSkeleton />
      </div>
      <KnowledgeBaseTableSkeleton />
    </PageLayout>
  );
}
