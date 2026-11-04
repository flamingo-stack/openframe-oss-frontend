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
import { commitLocalUpdate, fetchQuery, useQueryLoader, useRelayEnvironment } from 'react-relay';
import { ConnectionHandler } from 'relay-runtime';
import type { notificationsSectionRelayQuery as NotificationsSectionRelayQueryType } from '@/__generated__/notificationsSectionRelayQuery.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { registerLiveConnectionPairs, subscribeReadStatusRefresh } from '@/graphql/notifications/live-connection-pairs';
import {
  NOTIFICATIONS_CONNECTION_KEY,
  notificationsConnectionFilters,
  parseNotificationEntityScope,
  UNFILTERED_NOTIFICATION_PAIR,
} from '@/graphql/notifications/notifications-helpers';
import { notificationsSectionRelayQuery } from '@/graphql/notifications/notifications-section-relay';
import { useNotificationMutations } from '@/graphql/notifications/use-notification-mutations';
import { entityScopeLabel } from './entity-scope-label';
import { NOTIFICATIONS_SECTION_PAGE_SIZE, NotificationsSection } from './notifications-section';

const SEARCH_DEBOUNCE_MS = 300;
// Archiving a ticket sends one live event per notification; coalesce them into one refetch.
const READ_STATUS_REFRESH_DEBOUNCE_MS = 500;

const NOTIFICATIONS_TABS: TabItem[] = [
  { id: 'new', label: 'New Notifications', icon: BellIcon },
  { id: 'history', label: 'Notifications History', icon: ClockHistoryIcon },
];

export function NotificationsPageView() {
  const { toast } = useToast();

  const { params, setParam, setParams } = useApiParams({
    tab: { type: 'string', default: 'new' },
    search: { type: 'string', default: '' },
    entityType: { type: 'string', default: '' },
    entityId: { type: 'string', default: '' },
    entityName: { type: 'string', default: '' },
  });

  // A row's unread count opens the page scoped to its entity (`routes.notifications({ entity })`).
  const entity = parseNotificationEntityScope(params.entityType, params.entityId);
  const clearEntity = () => setParams({ entityType: '', entityId: '', entityName: '' });

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

  // One builder for the query variables and the connection keys the updaters look up: the two must match exactly.
  // Keyed on the URL's strings: the parsed scope is a new object every render.
  const filterPairs = useMemo(() => {
    const scope = parseNotificationEntityScope(params.entityType, params.entityId);
    return [
      {
        unread: notificationsConnectionFilters(false, debouncedSearch, scope),
        read: notificationsConnectionFilters(true, debouncedSearch, scope),
      },
      UNFILTERED_NOTIFICATION_PAIR,
    ];
  }, [debouncedSearch, params.entityType, params.entityId]);
  const [pagePair] = filterPairs;

  useEffect(() => {
    loadNew(
      { first: NOTIFICATIONS_SECTION_PAGE_SIZE, after: null, ...pagePair.unread },
      { fetchPolicy: 'network-only' },
    );
    return () => disposeNew();
  }, [loadNew, disposeNew, pagePair]);

  useEffect(() => {
    loadHistory(
      { first: NOTIFICATIONS_SECTION_PAGE_SIZE, after: null, ...pagePair.read },
      { fetchPolicy: 'network-only' },
    );
    return () => disposeHistory();
  }, [loadHistory, disposeHistory, pagePair]);

  // A live read-state event reaches the drawer's unfiltered pair by name; this page's
  // search-keyed pair it has to be told about, or a card read elsewhere stays in the table.
  useEffect(() => registerLiveConnectionPairs(filterPairs), [filterPairs]);

  // Subscribed at the page, not in the history tab: an archive landing while "New" is open
  // still moves the card into history, and it must carry its flag when that tab opens.
  const environment = useRelayEnvironment();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeReadStatusRefresh(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const variables = historyQueryRef?.variables;
        if (!variables) return;
        // Ask for every row the list holds — paged in, or moved in live while the tab was closed —
        // so the refetch, which replaces the edges, doesn't shrink it.
        let loaded = 0;
        commitLocalUpdate(environment, store => {
          const filters = { filter: variables.filter, search: variables.search };
          const conn = ConnectionHandler.getConnection(store.getRoot(), NOTIFICATIONS_CONNECTION_KEY, filters);
          loaded = conn?.getLinkedRecords('edges')?.length ?? 0;
        });
        fetchQuery<NotificationsSectionRelayQueryType>(
          environment,
          notificationsSectionRelayQuery,
          { ...variables, first: Math.max(variables.first, loaded) },
          { fetchPolicy: 'network-only' },
        ).subscribe({
          // Background reconciliation: a failure leaves the row untagged until the next load.
          error: () => {},
        });
      }, READ_STATUS_REFRESH_DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [environment, historyQueryRef]);

  const onMarkAllReadCompleted = useCallback(() => {
    toast({ title: 'All notifications marked as read', variant: 'success' });
  }, [toast]);

  const scopeLabel = entity ? entityScopeLabel(entity.type, params.entityName) : '';
  const onMarkEntityReadCompleted = useCallback(() => {
    toast({ title: 'Notifications marked as read', description: scopeLabel, variant: 'success' });
  }, [toast, scopeLabel]);

  const onDeleteAllReadCompleted = useCallback(() => {
    toast({ title: 'All read notifications deleted', variant: 'success' });
  }, [toast]);

  const {
    markRead,
    markAllRead,
    markEntityRead,
    removeNotification,
    removeAllRead,
    isMarkingAllRead,
    isMarkingEntityRead,
    isDeletingAllRead,
  } = useNotificationMutations({
    filterPairs,
    onMarkAllReadCompleted,
    onMarkEntityReadCompleted,
    onDeleteAllReadCompleted,
  });

  // Scoped to one entity, "all" is that entity's: the global mark-all would read every other notification too.
  const newActions: PageActionButton[] = [
    {
      label: 'Mark All Complete',
      icon: <CheckCircleIcon className="text-ods-text-secondary" />,
      onClick: entity ? () => markEntityRead(entity) : markAllRead,
      variant: 'outline',
      disabled: entity ? isMarkingEntityRead : isMarkingAllRead,
    },
  ];

  const [isDeleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);

  // The update is optimistic — the table empties at once — so the dialog closes on confirm
  // instead of waiting for the mutation; a failure still surfaces through the hook's toast.
  const confirmDeleteAll = () => {
    setDeleteAllConfirmOpen(false);
    removeAllRead();
  };

  // Not while scoped to one entity: the backend deletes every read notification, and has no per-entity delete.
  const historyActions: PageActionButton[] = entity
    ? []
    : [
        {
          label: 'Delete All',
          icon: <TrashIcon className="text-ods-error" />,
          onClick: () => setDeleteAllConfirmOpen(true),
          variant: 'outline',
          disabled: isDeletingAllRead,
        },
      ];

  const scope = entity ? { label: scopeLabel, onClear: clearEntity } : undefined;

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
          scope={scope}
          rowVariant="read"
          onMarkRead={markRead}
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
          scope={scope}
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
