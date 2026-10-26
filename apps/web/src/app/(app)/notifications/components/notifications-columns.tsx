'use client';

import type { Notification, NotificationSeverity } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  ArrowRightUpIcon,
  CheckCircleIcon,
  TrashIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  dotColorByVariant,
  type Row,
  SplitButton,
  Tag,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn, formatTicketRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import { getNotificationIcon } from '@/app/components/notifications/notification-category-icons';
import { resolveNotificationAction } from '@/app/components/notifications/notification-navigation';
import { openMingoDialogInDrawer } from '@/app/components/notifications/open-mingo-dialog';

export interface NotificationRow {
  id: string;
  title: string;
  description: string | null | undefined;
  createdAt: number;
  read: boolean;
  /** Read automatically because its entity was archived; flagged until the user interacts with it. */
  archived: boolean;
  notification: Notification;
}

interface BuildColumnsArgs {
  rowVariant: 'unread' | 'read';
  /**
   * `MingoLauncherStore.canOpen`, SUBSCRIBED by the caller.
   *
   * This cell has to decide `href` vs `onClick` during render, so unlike the other
   * `mingoDrawerDialogId` callers it cannot ask at click time — and a bare `getState()`
   * read here would freeze whatever the flags happened to say when the row first
   * rendered.
   */
  canOpenMingoDrawer?: boolean;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

/** Row label color per the Figma table row: DANGER red, WARNING amber, SUCCESS green, INFO/default primary. */
const titleColorBySeverity: Partial<Record<NotificationSeverity, string>> = {
  DANGER: 'text-ods-error',
  WARNING: 'text-ods-warning',
  SUCCESS: 'text-ods-success',
};

/**
 * How many lines of the description a row shows before it ellipsizes (the full
 * text stays in the tooltip).
 *
 * Two, because that is what fits the table's design row height — 78px of cell on
 * desktop (kind label 24 + 2×20) and 66px on a phone (title 20 + 2×16). Three
 * needed the row to grow with its content, which made every row a different
 * height: the skeleton could not match it, so the list jumped on load.
 */
const DESCRIPTION_LINES = 2;

function NotificationTitle({ row, className }: { row: NotificationRow; className: string }) {
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
      <TruncateText className={className}>{row.title ?? ''}</TruncateText>
      {row.archived ? <Tag label="Archived" variant="grey" className="shrink-0" /> : null}
    </div>
  );
}

export function buildNotificationColumns({
  rowVariant,
  canOpenMingoDrawer = false,
  onMarkRead,
  onDelete,
}: BuildColumnsArgs): ColumnDef<NotificationRow>[] {
  return [
    {
      id: 'notification',
      accessorKey: 'title',
      header: 'Notification',
      enableSorting: false,
      meta: { width: 'flex-[2] min-w-0' },
      cell: ({ row }: { row: Row<NotificationRow> }) => <NotificationCell row={row.original} />,
    },
    {
      id: 'details',
      accessorKey: 'description',
      header: '',
      enableSorting: false,
      meta: { width: 'flex-[3] min-w-0', hideAt: 'md' },
      cell: ({ row }: { row: Row<NotificationRow> }) => <NotificationDetailsCell row={row.original} />,
    },
    {
      id: 'action',
      header: '',
      enableSorting: false,
      meta: { width: 'w-11 shrink-0 content-md:w-[210px]', align: 'right' },
      cell: ({ row }: { row: Row<NotificationRow> }) => {
        // A row still being read has no action yet (only some notifications carry one): the slot stays empty.
        if (!row.original.notification) return null;
        const action = resolveNotificationAction(row.original.notification);
        if (!action) return null;
        // A Mingo dialog opens the in-layout drawer instead of navigating — but only
        // where that drawer exists. Every action carries a route, so anything else
        // (and a shell with no drawer) keeps the open-in-new-tab anchor. Bound to a
        // const so it narrows inside the closure.
        const drawerDialogId = canOpenMingoDrawer ? (action.mingoDialogId ?? null) : null;
        const navigates = !drawerDialogId;
        const { id, read, archived } = row.original;
        const markRead = !read || archived ? () => onMarkRead?.(id) : undefined;
        // Opening clears unread: the drawer changes no URL of its own here (the sync
        // hook stamps one a commit later), so the location-based auto-reader can't.
        const openDrawer = drawerDialogId
          ? () => {
              openMingoDialogInDrawer(drawerDialogId);
              markRead?.();
            }
          : undefined;
        // Any open of an archived row clears its flag, a navigation included: only ticket and
        // dialog pages auto-read on arrival, and the new-tab half leaves this row on screen.
        const onOpen = openDrawer ?? (archived ? markRead : undefined);
        return (
          <div data-no-row-click className="flex w-full justify-end">
            <SplitButton
              className="hidden content-md:inline-flex"
              variant="outline"
              href={navigates ? action.route : undefined}
              onClick={onOpen}
              groupAriaLabel={action.label}
              iconAction={{
                icon: <ArrowRightUpIcon className="text-ods-text-secondary" />,
                'aria-label': navigates ? `Open ${action.label} in new tab` : `Open ${action.label}`,
                href: navigates ? action.route : undefined,
                onClick: onOpen,
                openInNewTab: navigates,
              }}
            >
              {action.label}
            </SplitButton>
            {/* Mobile: the labeled SplitButton doesn't fit — collapse to an icon-only open button. */}
            <Button
              className="content-md:hidden"
              variant="outline"
              size="icon"
              href={navigates ? action.route : undefined}
              onClick={onOpen}
              aria-label={action.label}
              leftIcon={<ArrowRightUpIcon />}
            />
          </div>
        );
      },
    },
    {
      id: 'rowIcon',
      header: '',
      enableSorting: false,
      meta: { width: 'w-11 shrink-0 content-md:w-12', align: 'right' },
      cell: ({ row }: { row: Row<NotificationRow> }) => (
        <RowIconCell row={row.original} rowVariant={rowVariant} onMarkRead={onMarkRead} onDelete={onDelete} />
      ),
    },
  ];
}

/** The icon, the title and the time (the title over the description on a phone); their own bars while the row is read. */
function NotificationCell({ row }: { row: NotificationRow }) {
  const loading = useLoadingScope() && !row.notification;
  const { severity, variant = 'default' } = row.notification ?? {};
  const titleColor = (severity && titleColorBySeverity[severity]) ?? 'text-ods-text-primary';
  const relativeTime = loading ? '' : formatTicketRelativeTime(new Date(row.createdAt).toISOString());
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-m)]">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-ods-border text-ods-text-secondary">
        {loading ? (
          <UnifiedSkeleton className="size-4 rounded" />
        ) : (
          (getNotificationIcon(row.notification) ?? (
            <span className={cn('size-1.5 rounded-full', dotColorByVariant[variant])} />
          ))
        )}
      </div>
      <div className="hidden min-w-0 flex-col gap-[var(--spacing-system-xxs)] content-md:flex">
        {/* Real content leads; the context-derived kind label moved to the details column. */}
        <NotificationTitle row={row} className={titleColor} />
        {loading ? (
          <TextLineSkeleton type="h6" className="w-24" />
        ) : (
          <span className="truncate text-ods-text-secondary text-h6">{relativeTime}</span>
        )}
      </div>
      {/* Mobile: the details column is hidden, so title + description collapse into this cell. */}
      <div className="flex min-w-0 flex-col content-md:hidden">
        <NotificationTitle row={row} className={titleColor} />
        <TruncateText lines={DESCRIPTION_LINES} variant="h6" tone="secondary" className="break-words">
          {row.description || relativeTime}
        </TruncateText>
      </div>
    </div>
  );
}

/** The kind label over the description; both draw their bars while the row is read. */
function NotificationDetailsCell({ row }: { row: NotificationRow }) {
  // The title owns the first column; this one carries the kind label (when the
  // context isn't generic) and the description.
  const loading = useLoadingScope() && !row.notification;
  const kindLabel = row.notification?.type;
  return (
    <div className="flex min-w-0 flex-col">
      {kindLabel || loading ? <TruncateText>{kindLabel ?? ''}</TruncateText> : null}
      {row.description || loading ? (
        <TruncateText lines={DESCRIPTION_LINES} variant="h6" tone="secondary" className="break-words">
          {row.description ?? ''}
        </TruncateText>
      ) : null}
    </div>
  );
}

/** Mark as done (unread) or delete (read). Static chrome: drawn real while the row is read, and inert. */
function RowIconCell({
  row,
  rowVariant,
  onMarkRead,
  onDelete,
}: {
  row: NotificationRow;
  rowVariant: 'unread' | 'read';
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const loading = useLoadingScope() && !row.notification;
  return (
    <div data-no-row-click className="flex items-center justify-end">
      {rowVariant === 'unread' ? (
        <Button
          size="icon"
          variant="outline"
          aria-label="Mark as done"
          onClick={() => onMarkRead?.(row.id)}
          disabled={loading}
          leftIcon={<CheckCircleIcon size={24} />}
        />
      ) : (
        <Button
          size="icon"
          variant="outline"
          aria-label="Delete notification"
          onClick={() => onDelete?.(row.id)}
          disabled={loading}
          leftIcon={<TrashIcon size={24} className="text-ods-error" />}
        />
      )}
    </div>
  );
}
