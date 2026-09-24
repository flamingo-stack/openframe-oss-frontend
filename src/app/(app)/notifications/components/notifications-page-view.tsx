'use client';

import { type TabItem, TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import {
  BellIcon,
  CheckCircleIcon,
  ClockHistoryIcon,
  TrashIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryLoader } from 'react-relay';
import type { notificationsSectionRelayQuery as NotificationsSectionRelayQueryType } from '@/__generated__/notificationsSectionRelayQuery.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { registerLiveConnectionPairs } from '@/graphql/notifications/live-connection-pairs';
import {
  notificationsConnectionFilters,
  UNFILTERED_NOTIFICATION_PAIR,
} from '@/graphql/notifications/notifications-helpers';
import { notificationsSectionRelayQuery } from '@/graphql/notifications/notifications-section-relay';
import { useNotificationMutations } from '@/graphql/notifications/use-notification-mutations';
import { NOTIFICATIONS_SECTION_PAGE_SIZE, NotificationsSection } from './notifications-section';

const SEARCH_DEBOUNCE_MS = 300;

const NOTIFICATIONS_TABS: TabItem[] = [
  { id: 'new', label: 'New Notifications', icon: BellIcon },
  { id: 'history', label: 'Notifications History', icon: ClockHistoryIcon },
];

export function NotificationsPageView() {
  const { toast } = useToast();

  const { params, setParam, setParams } = useApiParams({
    tab: { type: 'string', default: 'new' },
    search: { type: 'string', default: '' },
  });

  // One shared search across both tabs; the hook keeps typing responsive and
  // debounces the write to the URL param.
  const { search, setSearch, debouncedSearch } = useSearchParam(
    params.search,
    value => setParam('search', value),
    SEARCH_DEBOUNCE_MS,
  );

  // Clear the shared search on a tab switch so each tab starts fresh. Done in the
  // handler (a user action) so deep links like `?tab=history&search=x` still load
  // with their search intact.
  const handleTabChange = useCallback(
    (tabId: string) => {
      setSearch('');
      setParams({ tab: tabId, search: '' });
    },
    [setSearch, setParams],
  );

  const [newQueryRef, loadNew, disposeNew] =
    useQueryLoader<NotificationsSectionRelayQueryType>(notificationsSectionRelayQuery);
  const [historyQueryRef, loadHistory, disposeHistory] =
    useQueryLoader<NotificationsSectionRelayQueryType>(notificationsSectionRelayQuery);

  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    loadNew(
      { first: NOTIFICATIONS_SECTION_PAGE_SIZE, after: null, filter: { read: false }, search: trimmed || null },
      { fetchPolicy: 'network-only' },
    );
    return () => disposeNew();
  }, [loadNew, disposeNew, debouncedSearch]);

  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    loadHistory(
      { first: NOTIFICATIONS_SECTION_PAGE_SIZE, after: null, filter: { read: true }, search: trimmed || null },
      { fetchPolicy: 'network-only' },
    );
    return () => disposeHistory();
  }, [loadHistory, disposeHistory, debouncedSearch]);

  const filterPairs = useMemo(
    () => [
      {
        unread: notificationsConnectionFilters(false, debouncedSearch),
        read: notificationsConnectionFilters(true, debouncedSearch),
      },
      UNFILTERED_NOTIFICATION_PAIR,
    ],
    [debouncedSearch],
  );

  // A live READ / DELETED event reaches the drawer's unfiltered pair by name; this page's
  // search-keyed pair it has to be told about, or a card read elsewhere stays in the table.
  useEffect(() => registerLiveConnectionPairs(filterPairs), [filterPairs]);

  const onMarkAllReadCompleted = useCallback(() => {
    toast({ title: 'All notifications marked as read', variant: 'success' });
  }, [toast]);

  const onDeleteAllReadCompleted = useCallback(() => {
    toast({ title: 'All read notifications deleted', variant: 'success' });
  }, [toast]);

  const { markRead, markAllRead, removeNotification, removeAllRead, isMarkingAllRead, isDeletingAllRead } =
    useNotificationMutations({
      filterPairs,
      onMarkAllReadCompleted,
      onDeleteAllReadCompleted,
    });

  const newActions: PageActionButton[] = [
    {
      label: 'Mark All Complete',
      icon: <CheckCircleIcon className="text-ods-text-secondary" />,
      onClick: markAllRead,
      variant: 'outline',
      disabled: isMarkingAllRead,
    },
  ];

  const [isDeleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);

  // The update is optimistic — the table empties at once — so the dialog closes on confirm
  // instead of waiting for the mutation; a failure still surfaces through the hook's toast.
  const confirmDeleteAll = () => {
    setDeleteAllConfirmOpen(false);
    removeAllRead();
  };

  const historyActions: PageActionButton[] = [
    {
      label: 'Delete All',
      icon: <TrashIcon className="text-ods-error" />,
      onClick: () => setDeleteAllConfirmOpen(true),
      variant: 'outline',
      disabled: isDeletingAllRead,
    },
  ];

  const activeTab = params.tab === 'history' ? 'history' : 'new';

  return (
    <div className="flex w-full flex-col">
      <div className="px-[var(--spacing-system-l)]">
        <TabNavigation tabs={NOTIFICATIONS_TABS} activeTab={activeTab} urlSync={false} onTabChange={handleTabChange} />
      </div>

      {activeTab === 'history' ? (
        <NotificationsSection
          key="history"
          title="Notifications History"
          queryRef={historyQueryRef}
          searchValue={search}
          onSearchChange={setSearch}
          rowVariant="read"
          onDelete={removeNotification}
          actions={historyActions}
        />
      ) : (
        <NotificationsSection
          key="new"
          title="New Notifications"
          queryRef={newQueryRef}
          searchValue={search}
          onSearchChange={setSearch}
          rowVariant="unread"
          onMarkRead={markRead}
          actions={newActions}
        />
      )}

      <ConfirmDialog
        open={isDeleteAllConfirmOpen}
        onOpenChange={setDeleteAllConfirmOpen}
        title="Delete All Notifications"
        description="All notifications in history will be permanently deleted, including those hidden by the current search. This action cannot be undone."
        confirmLabel="Delete All"
        variant="destructive"
        onConfirm={confirmDeleteAll}
      />
    </div>
  );
}
