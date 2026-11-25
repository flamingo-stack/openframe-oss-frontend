'use client';

import type { Notification, NotificationSeverity } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  GRID_ACTION_BUTTON_CLASS,
  GridTextWithDetailCell,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  ArrowRightUpIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  TrashIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  dotColorByVariant,
  FloatingTooltip,
  GRID_ACTION_COLUMN_SIZE,
  GRID_MIN_WIDTH,
  type Row,
  SplitButton,
  Tag,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn, formatTicketRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ComponentProps, MouseEvent as ReactMouseEvent } from 'react';
import { getNotificationIcon } from '@/app/components/notifications/notification-category-icons';
import {
  isNotificationLinkAction,
  resolveNotificationAction,
} from '@/app/components/notifications/notification-navigation';
import { canOpenMingoDialogOverPage, openMingoDialog } from '@/app/components/notifications/open-mingo-dialog';
import type { TableLayout } from '@/app/hooks/use-table-layout';

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
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  /**
   * The layout the table draws. The grid names its second column in the header (a grid header cell is where a column
   * is resized and found); the card header leaves it blank, as it was. Default: card rows.
   */
  layout?: TableLayout;
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

/**
 * The columns. `cell` and `meta.width` are the card row's. Beside them each data column states what the grid layout
 * reads: a `size`, a `minSize` where the cell holds more than text, a one-line `gridCell` and a `label` for the
 * settings menu. The two buttons are the grid's action columns, kept by hand: `actionColumn()` would replace the card
 * layout's `meta` (its widths).
 */
export function buildNotificationColumns({
  rowVariant,
  onMarkRead,
  onDelete,
  layout = 'cards',
}: BuildColumnsArgs): ColumnDef<NotificationRow>[] {
  return [
    {
      id: 'notification',
      accessorKey: 'title',
      header: 'Notification',
      enableSorting: false,
      size: 320,
      minSize: GRID_MIN_WIDTH.media,
      meta: {
        width: 'flex-[2] min-w-0',
        label: 'Notification',
        gridCell: ({ row }: { row: Row<NotificationRow> }) => <NotificationGridCell row={row.original} />,
      },
      cell: ({ row }: { row: Row<NotificationRow> }) => <NotificationCell row={row.original} />,
    },
    {
      id: 'details',
      accessorKey: 'description',
      header: layout === 'grid' ? 'Details' : '',
      enableSorting: false,
      // The last data column: it takes the table's free width.
      size: 480,
      meta: {
        width: 'flex-[3] min-w-0',
        hideAt: 'md',
        label: 'Details',
        gridCell: ({ row }: { row: Row<NotificationRow> }) => <NotificationDetailsGridCell row={row.original} />,
      },
      cell: ({ row }: { row: Row<NotificationRow> }) => <NotificationDetailsCell row={row.original} />,
    },
    {
      id: 'action',
      header: '',
      // As `actionColumn()` states them: an action column is never sorted and never hidden.
      enableSorting: false,
      enableHiding: false,
      size: GRID_ACTION_COLUMN_SIZE,
      meta: {
        width: 'w-11 shrink-0 content-md:w-[210px]',
        align: 'right',
        gridKind: 'action',
        gridCell: ({ row }: { row: Row<NotificationRow> }) => (
          <NotificationActionCell row={row.original} onMarkRead={onMarkRead} grid />
        ),
      },
      cell: ({ row }: { row: Row<NotificationRow> }) => (
        <NotificationActionCell row={row.original} onMarkRead={onMarkRead} />
      ),
    },
    {
      id: 'rowIcon',
      header: '',
      enableSorting: false,
      enableHiding: false,
      size: GRID_ACTION_COLUMN_SIZE,
      meta: {
        width: 'w-11 shrink-0 content-md:w-12',
        align: 'right',
        gridKind: 'action',
        gridCell: ({ row }: { row: Row<NotificationRow> }) => (
          <RowIconCell row={row.original} rowVariant={rowVariant} onMarkRead={onMarkRead} onDelete={onDelete} grid />
        ),
      },
      cell: ({ row }: { row: Row<NotificationRow> }) => (
        <RowIconCell row={row.original} rowVariant={rowVariant} onMarkRead={onMarkRead} onDelete={onDelete} />
      ),
    },
  ];
}

/**
 * The notification's own action: open what it is about. A card row draws a labelled button (and an icon-only one on a
 * phone, where the label does not fit). `grid`: the grid's 56px action column holds one bare icon button, the phone's,
 * with the label as its name and its tooltip.
 */
function NotificationActionCell({
  row,
  onMarkRead,
  grid = false,
}: {
  row: NotificationRow;
  onMarkRead?: (id: string) => void;
  grid?: boolean;
}) {
  // A row still being read has no action yet (only some notifications carry one): the slot stays empty.
  if (!row.notification) return null;
  const action = resolveNotificationAction(row.notification);
  if (!action) return null;
  const { id, read, archived } = row;
  // Any open of an archived row clears its flag: only ticket and dialog pages
  // auto-read on arrival, and the new-tab half leaves this row on screen. An
  // announcement's link is never read by arrival (`readOnOpen`), so any open of an
  // unread one reads it too.
  const onOpen = archived || (action.readOnOpen && !read) ? () => onMarkRead?.(id) : undefined;
  if (isNotificationLinkAction(action)) {
    // A page outside the app: one button, since it always opens a new tab.
    if (grid) {
      return (
        <GridActionButton
          tooltip={action.label}
          href={action.externalUrl}
          openInNewTab
          onClick={onOpen}
          aria-label={`${action.label} in new tab`}
          leftIcon={<ExternalLinkIcon className="h-5 w-5" />}
        />
      );
    }
    return (
      <div data-no-row-click className="flex w-full justify-end">
        <Button
          className="hidden content-md:inline-flex"
          variant="outline"
          href={action.externalUrl}
          openInNewTab
          onClick={onOpen}
          rightIcon={<ExternalLinkIcon className="text-ods-text-secondary" />}
        >
          {action.label}
        </Button>
        <Button
          className="content-md:hidden"
          variant="outline"
          size="icon"
          href={action.externalUrl}
          openInNewTab
          onClick={onOpen}
          aria-label={`${action.label} in new tab`}
          leftIcon={<ExternalLinkIcon />}
        />
      </div>
    );
  }
  const dialogId = action.mingoDialogId ?? null;
  // A Mingo chat opens over this page when the composer dock can (the sheet, as the
  // classic drawer did), unless the click asks for a new tab or window. No URL
  // changes then, so opening clears the row's unread here.
  const onOpenHere = (event: ReactMouseEvent<HTMLElement>) => {
    const newTab = event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0;
    if (dialogId && !newTab && canOpenMingoDialogOverPage()) {
      event.preventDefault();
      openMingoDialog(dialogId);
      if (!read || archived) onMarkRead?.(id);
      return;
    }
    onOpen?.();
  };
  if (grid) {
    // One button: it opens here, and a modifier click opens a new tab as on any link.
    return (
      <GridActionButton
        tooltip={action.label}
        href={action.route}
        onClick={onOpenHere}
        aria-label={action.label}
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
      />
    );
  }
  return (
    <div data-no-row-click className="flex w-full justify-end">
      <SplitButton
        className="hidden content-md:inline-flex"
        variant="outline"
        href={action.route}
        onClick={onOpenHere}
        groupAriaLabel={action.label}
        iconAction={{
          icon: <ArrowRightUpIcon className="text-ods-text-secondary" />,
          'aria-label': `Open ${action.label} in new tab`,
          href: action.route,
          onClick: onOpen,
          openInNewTab: true,
        }}
      >
        {action.label}
      </SplitButton>
      {/* Mobile: the labeled SplitButton doesn't fit — collapse to an icon-only open button. */}
      <Button
        className="content-md:hidden"
        variant="outline"
        size="icon"
        href={action.route}
        onClick={onOpenHere}
        aria-label={action.label}
        leftIcon={<ArrowRightUpIcon />}
      />
    </div>
  );
}

/**
 * The bare 40px icon button of a grid action cell (the 56px cell is its frame). `tooltip`: what the button does, for
 * a button whose card form prints it as a label.
 */
function GridActionButton({ tooltip, ...button }: { tooltip?: string } & ComponentProps<typeof Button>) {
  const control = <Button variant="transparent" size="icon" className={GRID_ACTION_BUTTON_CLASS} {...button} />;
  return (
    <div data-no-row-click className="flex items-center justify-end">
      {tooltip ? (
        <FloatingTooltip as="span" side="top" content={tooltip} triggerClassName="flex">
          {control}
        </FloatingTooltip>
      ) : (
        control
      )}
    </div>
  );
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

/**
 * The grid's notification cell, one line: the category icon, the title in its severity colour (cut with an ellipsis
 * when the column is narrow), the Archived tag and the time, which is never cut.
 */
function NotificationGridCell({ row }: { row: NotificationRow }) {
  const loading = useLoadingScope() && !row.notification;
  const { severity, variant = 'default' } = row.notification ?? {};
  const titleColor = (severity && titleColorBySeverity[severity]) ?? 'text-ods-text-primary';
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
      <span className="flex size-5 shrink-0 items-center justify-center text-ods-text-secondary">
        {loading ? (
          <UnifiedSkeleton className="size-4 rounded" />
        ) : (
          (getNotificationIcon(row.notification) ?? (
            <span className={cn('size-1.5 rounded-full', dotColorByVariant[variant])} />
          ))
        )}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xxs)] overflow-hidden">
        <TruncateText as="span" className={titleColor} triggerClassName="flex-1">
          {row.title ?? ''}
        </TruncateText>
        {/* Only a row read because its entity was archived has it: the wait leaves it out. */}
        {row.archived ? (
          <span data-loading-optional className="flex shrink-0">
            <Tag as="span" label="Archived" variant="grey" />
          </span>
        ) : null}
        {loading ? (
          <TextLineSkeleton type="h6" className="w-16 shrink-0" />
        ) : (
          <span data-part="time" className="shrink-0 whitespace-nowrap text-ods-text-secondary text-h6">
            {formatTicketRelativeTime(new Date(row.createdAt).toISOString())}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The grid's details cell, one line: the kind, then the description in the secondary tone, cut with an ellipsis and
 * shown whole in a tooltip. A card row prints the description on two lines under the kind.
 */
function NotificationDetailsGridCell({ row }: { row: NotificationRow }) {
  const loading = useLoadingScope() && !row.notification;
  const kindLabel = row.notification?.type;
  const description = row.description ?? undefined;
  if (kindLabel || loading) return <GridTextWithDetailCell text={kindLabel ?? ''} detail={description} />;
  if (!description) return null;
  return (
    <TruncateText as="span" variant="h6" tone="secondary" triggerClassName="flex-1">
      {description}
    </TruncateText>
  );
}

/** Mark as done (unread) or delete (read). Static chrome: drawn real while the row is read, and inert. */
function RowIconCell({
  row,
  rowVariant,
  onMarkRead,
  onDelete,
  grid = false,
}: {
  row: NotificationRow;
  rowVariant: 'unread' | 'read';
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** The button's form in a grid action column: bare, the cell is its frame. Default: the outlined button of a card row. */
  grid?: boolean;
}) {
  const loading = useLoadingScope() && !row.notification;
  if (grid) {
    return rowVariant === 'unread' ? (
      <GridActionButton
        aria-label="Mark as done"
        onClick={() => onMarkRead?.(row.id)}
        disabled={loading}
        leftIcon={<CheckCircleIcon className="h-5 w-5" />}
      />
    ) : (
      <GridActionButton
        aria-label="Delete notification"
        onClick={() => onDelete?.(row.id)}
        disabled={loading}
        leftIcon={<TrashIcon className="h-5 w-5 text-ods-error" />}
      />
    );
  }
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
