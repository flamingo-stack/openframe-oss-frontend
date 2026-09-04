'use client';

import type { Notification, NotificationSeverity } from '@flamingo-stack/openframe-frontend-core';
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
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn, formatTicketRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import { getNotificationCategoryIcon } from '@/app/components/notifications/notification-category-icons';
import { resolveNotificationAction } from '@/app/components/notifications/notification-navigation';
import { openMingoDialogInDrawer } from '@/app/components/notifications/open-mingo-dialog';

export interface NotificationRow {
  id: string;
  title: string;
  description: string | null | undefined;
  createdAt: number;
  read: boolean;
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
      cell: ({ row }: { row: Row<NotificationRow> }) => {
        const { category, severity, variant = 'default' } = row.original.notification;
        const titleColor = (severity && titleColorBySeverity[severity]) ?? 'text-ods-text-primary';
        const relativeTime = formatTicketRelativeTime(new Date(row.original.createdAt).toISOString());
        return (
          <div className="flex min-w-0 items-center gap-[var(--spacing-system-m)]">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-ods-border text-ods-text-secondary">
              {getNotificationCategoryIcon(category) ?? (
                <span className={cn('size-1.5 rounded-full', dotColorByVariant[variant])} />
              )}
            </div>
            <div className="hidden min-w-0 flex-col gap-[var(--spacing-system-xxs)] md:flex">
              {/* Real content leads; the context-derived kind label moved to the details column. */}
              <TruncateText className={titleColor}>{row.original.title}</TruncateText>
              <span className="truncate text-ods-text-secondary text-h6">{relativeTime}</span>
            </div>
            {/* Mobile: the details column is hidden, so title + description collapse into this cell. */}
            <div className="flex min-w-0 flex-col md:hidden">
              <TruncateText className={titleColor}>{row.original.title}</TruncateText>
              <TruncateText lines={3} variant="h6" tone="secondary" className="break-words">
                {row.original.description || relativeTime}
              </TruncateText>
            </div>
          </div>
        );
      },
    },
    {
      id: 'details',
      accessorKey: 'description',
      header: '',
      enableSorting: false,
      meta: { width: 'flex-[3] min-w-0', hideAt: 'md' },
      cell: ({ row }: { row: Row<NotificationRow> }) => {
        // The title owns the first column; this one carries the kind label (when the
        // context isn't generic) and the description.
        const kindLabel = row.original.notification.type;
        return (
          <div className="flex min-w-0 flex-col">
            {kindLabel ? <TruncateText>{kindLabel}</TruncateText> : null}
            {row.original.description ? (
              <TruncateText lines={3} variant="h6" tone="secondary" className="break-words">
                {row.original.description}
              </TruncateText>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'action',
      header: '',
      enableSorting: false,
      meta: { width: 'w-11 shrink-0 md:w-[210px]', align: 'right' },
      cell: ({ row }: { row: Row<NotificationRow> }) => {
        const action = resolveNotificationAction(row.original.notification);
        if (!action) return null;
        // A Mingo dialog opens the in-layout drawer instead of navigating — but only
        // where that drawer exists. Every action carries a route, so anything else
        // (and a shell with no drawer) keeps the open-in-new-tab anchor. Bound to a
        // const so it narrows inside the closure.
        const drawerDialogId = canOpenMingoDrawer ? (action.mingoDialogId ?? null) : null;
        const navigates = !drawerDialogId;
        // Opening clears unread: the drawer changes no URL of its own here (the sync
        // hook stamps one a commit later), so the location-based auto-reader can't.
        // `onMarkRead` is only wired for the unread variant; it's a no-op for
        // already-read rows.
        const openDrawer = drawerDialogId
          ? () => {
              openMingoDialogInDrawer(drawerDialogId);
              onMarkRead?.(row.original.id);
            }
          : undefined;
        return (
          <div data-no-row-click className="flex w-full justify-end">
            <SplitButton
              className="hidden md:inline-flex"
              variant="outline"
              href={navigates ? action.route : undefined}
              onClick={openDrawer}
              groupAriaLabel={action.label}
              iconAction={{
                icon: <ArrowRightUpIcon className="text-ods-text-secondary" />,
                'aria-label': navigates ? `Open ${action.label} in new tab` : `Open ${action.label}`,
                href: navigates ? action.route : undefined,
                onClick: openDrawer,
                openInNewTab: navigates,
              }}
            >
              {action.label}
            </SplitButton>
            {/* Mobile: the labeled SplitButton doesn't fit — collapse to an icon-only open button. */}
            <Button
              className="md:hidden"
              variant="outline"
              size="icon"
              href={navigates ? action.route : undefined}
              onClick={openDrawer}
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
      meta: { width: 'w-11 shrink-0 md:w-12', align: 'right' },
      cell: ({ row }: { row: Row<NotificationRow> }) => (
        <div data-no-row-click className="flex items-center justify-end">
          {rowVariant === 'unread' ? (
            <Button
              size="icon"
              variant="outline"
              aria-label="Mark as done"
              onClick={() => onMarkRead?.(row.original.id)}
              leftIcon={<CheckCircleIcon size={24} />}
            />
          ) : (
            <Button
              size="icon"
              variant="outline"
              aria-label="Delete notification"
              onClick={() => onDelete?.(row.original.id)}
              leftIcon={<TrashIcon size={24} className="text-ods-error" />}
            />
          )}
        </div>
      ),
    },
  ];
}
