'use client';

import { getApprovalMeta, isApprovalNotification } from '@flamingo-stack/openframe-frontend-core';
import { LoadingFallback, LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { BellCheckIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Input,
  type NoDataProps,
  type PageActionButton,
  PageLayout,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type PreloadedQuery, usePaginationFragment, usePreloadedQuery } from 'react-relay';
import type { notificationsSectionRelay_query$key as NotificationsSectionFragmentKey } from '@/__generated__/notificationsSectionRelay_query.graphql';
import type { notificationsSectionRelayPaginationQuery as NotificationsSectionPaginationQueryType } from '@/__generated__/notificationsSectionRelayPaginationQuery.graphql';
import type { notificationsSectionRelayQuery as NotificationsSectionRelayQueryType } from '@/__generated__/notificationsSectionRelayQuery.graphql';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { EmptyState, type InfiniteScroll, NO_ITEMS } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { NotificationReadStatus } from '@/generated/schema-enums';
import {
  mapNotificationNode,
  parseCreatedAt,
  readNotificationNode,
  stripNotificationMarkup,
} from '@/graphql/notifications/notifications-helpers';
import {
  notificationsSectionRelayFragment,
  notificationsSectionRelayQuery,
} from '@/graphql/notifications/notifications-section-relay';
import { NotificationApprovalSubRow } from './notification-approval-subrow';
import { buildNotificationColumns, type NotificationRow } from './notifications-columns';

export const NOTIFICATIONS_SECTION_PAGE_SIZE = 50;
const HISTORY_RETENTION_NOTE = 'Notification history is retained for 30 days, then permanently deleted.';

interface NotificationsSectionProps {
  title: string;
  queryRef: PreloadedQuery<NotificationsSectionRelayQueryType> | null | undefined;
  searchValue: string;
  onSearchChange: (value: string) => void;
  actions?: PageActionButton[];
  rowVariant: 'unread' | 'read';
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function NotificationsSection({
  title,
  queryRef,
  searchValue,
  onSearchChange,
  actions,
  rowVariant,
  onMarkRead,
  onDelete,
}: NotificationsSectionProps) {
  // `null` until the list answers: the search stays drawn while it loads, the header actions wait for rows.
  const [isEmpty, setIsEmpty] = useState<boolean | null>(null);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  return (
    <PageLayout
      title={title}
      // Until the list answers the actions are drawn in their loading form; a list with no rows drops them.
      actions={isEmpty === true ? undefined : actions}
      loadingActions={isEmpty === null}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="flex flex-col" style={containerStyle}>
        {/* Genuinely no notifications (no active search) → the rich empty state stands alone;
            the search input is hidden per the empty-state convention. A search that matched
            nothing keeps the input so the query can be adjusted. */}
        {!(isEmpty === true && !searchValue.trim()) && (
          <div
            ref={toolbarRef}
            className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] flex items-center bg-ods-bg p-[var(--spacing-system-l)]"
          >
            <Input
              userValue
              placeholder="Search for Notification"
              value={searchValue}
              onChange={e => onSearchChange(e.target.value)}
              className="flex-1"
              startAdornment={<SearchIcon />}
            />
          </div>
        )}

        <SectionTable
          queryRef={queryRef}
          rowVariant={rowVariant}
          searchValue={searchValue}
          onMarkRead={onMarkRead}
          onDelete={onDelete}
          onEmptyChange={setIsEmpty}
          stickyHeaderOffset={stickyHeaderOffset}
        />
      </div>
    </PageLayout>
  );
}

interface SectionTableProps {
  /** Absent while the query has not even been started. */
  queryRef: PreloadedQuery<NotificationsSectionRelayQueryType> | null | undefined;
  rowVariant: 'unread' | 'read';
  searchValue: string;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
}

/** The section's table, with its own boundary: in its scope the reader draws its own loading form. */
function SectionTable(props: SectionTableProps) {
  return (
    <LoadingSuspense label={sectionLoadingLabel(props.rowVariant)}>
      <SectionTableReader {...props} />
    </LoadingSuspense>
  );
}

function SectionTableReader({ queryRef, ...props }: SectionTableProps) {
  // The table before its query answers: in a loading scope (its boundary's fallback, or an outer loading state), and
  // while the query has not even been started (no `queryRef` yet), the same table with no rows, reading nothing.
  const loadingTable = (
    <SectionTableLoading rowVariant={props.rowVariant} stickyHeaderOffset={props.stickyHeaderOffset} />
  );
  if (useLoadingScope()) return loadingTable;
  if (!queryRef) return <LoadingFallback label={sectionLoadingLabel(props.rowVariant)}>{loadingTable}</LoadingFallback>;
  return <SectionTableLive queryRef={queryRef} {...props} />;
}

/** The section's query: reads the notifications page and hands the rows to `SectionTableView`. */
function SectionTableLive({
  queryRef,
  rowVariant,
  searchValue,
  onMarkRead,
  onDelete,
  onEmptyChange,
  stickyHeaderOffset,
}: SectionTableProps & { queryRef: PreloadedQuery<NotificationsSectionRelayQueryType> }) {
  const { toast } = useToast();
  const queryData = usePreloadedQuery(notificationsSectionRelayQuery, queryRef);
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    NotificationsSectionPaginationQueryType,
    NotificationsSectionFragmentKey
  >(notificationsSectionRelayFragment, queryData);

  const rows = useMemo<NotificationRow[]>(
    () =>
      data.notifications.edges.map(edge => {
        // Read once: the table's own columns take the raw fields (markup-stripped,
        // same as the drawer tiles), the sub-row and actions take the mapped notification.
        const node = readNotificationNode(edge.node);
        return {
          id: node.id,
          title: stripNotificationMarkup(node.title),
          description: node.description == null ? null : stripNotificationMarkup(node.description),
          createdAt: parseCreatedAt(node.createdAt),
          read: node.read,
          archived: node.status === NotificationReadStatus.ARCHIVED,
          notification: mapNotificationNode(node),
        };
      }),
    [data.notifications.edges],
  );

  const onLoadMore = useCallback(() => {
    if (!hasNext || isLoadingNext) return;
    loadNext(NOTIFICATIONS_SECTION_PAGE_SIZE, {
      onComplete: err => {
        if (err) {
          toast({ title: 'Error loading more notifications', description: err.message, variant: 'destructive' });
        }
      },
    });
  }, [hasNext, isLoadingNext, loadNext, toast]);

  const isEmpty = rows.length === 0;
  useEffect(() => {
    onEmptyChange(isEmpty);
  }, [isEmpty, onEmptyChange]);

  return (
    <SectionTableView
      rows={rows}
      rowVariant={rowVariant}
      searchValue={searchValue}
      onMarkRead={onMarkRead}
      onDelete={onDelete}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore }}
      stickyHeaderOffset={stickyHeaderOffset}
    />
  );
}

function sectionLoadingLabel(rowVariant: 'unread' | 'read'): string {
  return rowVariant === 'unread' ? 'Loading unread notifications' : 'Loading notifications';
}

/** The section's query not answered yet: the same table with no rows, drawn in the caller's loading scope. */
function SectionTableLoading({
  rowVariant,
  stickyHeaderOffset,
}: {
  rowVariant: 'unread' | 'read';
  stickyHeaderOffset: string;
}) {
  return (
    <SectionTableView rows={NO_ITEMS} rowVariant={rowVariant} searchValue="" stickyHeaderOffset={stickyHeaderOffset} />
  );
}

interface SectionTableViewProps {
  rows: NotificationRow[];
  rowVariant: 'unread' | 'read';
  searchValue: string;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** The next page's infinite scroll; omitted while the first page is read. */
  infiniteScroll?: InfiniteScroll;
  stickyHeaderOffset: string;
}

/**
 * The notifications table, from props only. In a loading scope it holds one full page of placeholder rows
 * (`NOTIFICATIONS_SECTION_PAGE_SIZE`) drawn with its real cells under its real header.
 */
export function SectionTableView({
  rows,
  rowVariant,
  searchValue,
  onMarkRead,
  onDelete,
  infiniteScroll,
  stickyHeaderOffset,
}: SectionTableViewProps) {
  const loading = useLoadingScope();

  // Subscribed, not read imperatively: the action cell decides `href` vs `onClick` at
  // RENDER time, so a snapshot would freeze whatever the shell had published when the
  // first row rendered and never pick up the flags landing.
  const canOpenMingoDrawer = useMingoLauncherStore(state => state.canOpen);

  const columns = useMemo(
    () => buildNotificationColumns({ rowVariant, canOpenMingoDrawer, onMarkRead, onDelete }),
    [rowVariant, canOpenMingoDrawer, onMarkRead, onDelete],
  );

  const renderSubRow = useCallback(
    (item: NotificationRow) => {
      // A placeholder row (the table still loading) carries no notification.
      if (!item.notification) return null;
      if (!isApprovalNotification(item.notification) || !getApprovalMeta(item.notification)) return null;
      return (
        <NotificationApprovalSubRow
          notification={item.notification}
          onResolved={rowVariant === 'unread' ? onMarkRead : undefined}
        />
      );
    },
    [rowVariant, onMarkRead],
  );

  // In a loading scope the table holds one page of placeholder rows, drawn with the real cells (each cell draws its
  // own loading form).
  const loadingRows = useMemo(
    () => (loading ? loadingPlaceholderRows<NotificationRow>(NOTIFICATIONS_SECTION_PAGE_SIZE) : null),
    [loading],
  );

  const table = useDataTable<NotificationRow>({
    data: loadingRows ?? rows,
    columns,
    getRowId: row => row.id,
  });

  const trimmedSearch = searchValue.trim();
  const emptyState: NoDataProps = trimmedSearch
    ? {
        title: `No notifications found matching "${trimmedSearch}".`,
        description: 'Try adjusting your search.',
      }
    : {
        icon: <BellCheckIcon size={24} className="text-ods-text-secondary" />,
        title: rowVariant === 'unread' ? 'No new notifications' : 'No notifications history',
        description:
          rowVariant === 'read' ? HISTORY_RETENTION_NOTE : "You're all up to date with system alerts and messages.",
      };

  if (!loading && rows.length === 0) {
    return <EmptyState {...emptyState} />;
  }

  return (
    <>
      <LiveTable
        table={table}
        pageSize={NOTIFICATIONS_SECTION_PAGE_SIZE}
        stickyHeaderOffset={stickyHeaderOffset}
        itemName="result"
        renderSubRow={renderSubRow}
        footer={infiniteScroll}
        loadingCells={loading}
      />
      {rowVariant === 'read' && (
        <p className="mt-[var(--spacing-system-l)] text-center text-ods-text-secondary text-h6">
          {HISTORY_RETENTION_NOTE}
        </p>
      )}
    </>
  );
}
