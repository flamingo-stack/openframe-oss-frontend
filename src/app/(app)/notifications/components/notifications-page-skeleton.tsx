'use client';

import { TabBarSkeleton } from '@/app/components/shared';
import { NotificationsSection } from './notifications-section';

/**
 * Route-level skeleton for `/notifications`.
 *
 * The section is the REAL `NotificationsSection` with no `queryRef` — that is
 * precisely the state it renders while its query is in flight (header +
 * `SectionTableSkeleton`), so this is the loading page, not a copy of it.
 */

const TAB_WIDTHS = ['w-[210px]', 'w-[230px]'] as const;

const noop = () => {};

export function NotificationsPageSkeleton({ tab }: { tab?: string }) {
  const isHistory = tab === 'history';

  return (
    <div className="flex w-full flex-col">
      <div className="px-[var(--spacing-system-l)]">
        <TabBarSkeleton widths={TAB_WIDTHS} />
      </div>
      <NotificationsSection
        title={isHistory ? 'Notifications History' : 'New Notifications'}
        queryRef={null}
        searchValue=""
        onSearchChange={noop}
        rowVariant={isHistory ? 'read' : 'unread'}
      />
    </div>
  );
}
