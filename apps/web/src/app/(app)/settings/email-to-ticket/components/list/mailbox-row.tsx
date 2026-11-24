'use client';

import {
  type ColumnDef,
  DataTable,
  GRID_MIN_WIDTH,
  type Row,
  Tag,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { liveColumnMeta } from '@/app/components/shared';
import { openRowColumn } from '@/app/components/shared/open-row-column';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import type { Instant } from '@/lib/graphql-scalars';
import { pluralNoun } from '@/lib/pluralize';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import {
  mailboxProviderPresentation,
  RECEIVING_FILTER_OPTIONS,
  receivingStateLine,
  receivingStateTag,
} from '../../utils/mailbox-presentation';

/** A row as its cells read it; every field but `id` is absent on a loading row. */
export interface MailboxRow {
  id: string;
  supportAddress?: string;
  provider?: string;
  ticketsCreated?: number;
  receivingState?: string;
  lastEmailAt?: Instant | null;
  lastFinishedTestAt?: Instant | null;
}

export const MAILBOX_COLUMNS = {
  mailbox: { id: 'mailbox', header: 'Mailbox', width: 'flex-1 min-w-0' },
  // A phone keeps the mailbox and its status (Figma 4527-131708).
  tickets: { id: 'tickets', header: 'Tickets', width: 'w-40 shrink-0', hideAt: 'md', sortable: true },
  status: { id: 'status', header: 'Status', width: 'flex-none content-md:w-56 content-md:shrink-0' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export const getMailboxRowId = (row: MailboxRow) => row.id;
/** A loading row has no address yet: nothing to open. */
export const mailboxRowHref = (row: MailboxRow) =>
  row.supportAddress ? routes.settings.emailToTicket.details(row.id) : null;

const PROVIDER_LOGO_PX = 20;

function MailboxCell({ row }: { row: MailboxRow }) {
  const loading = useLoadingScope();
  const provider = row.provider ? mailboxProviderPresentation(row.provider) : null;
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        {provider && (
          <provider.Logo data-loading-optional size={PROVIDER_LOGO_PX} role="img" aria-label={provider.label} />
        )}
        <TruncateText className={loading ? 'w-48' : undefined}>{row.supportAddress ?? ''}</TruncateText>
      </div>
      <TruncateText variant="h6" tone="secondary" className={loading ? 'w-24' : undefined}>
        {provider?.label ?? ''}
      </TruncateText>
    </div>
  );
}

/** MAILBOX in the grid layout: one line, the provider's mark, the address, then the provider. */
function MailboxGridCell({ row }: { row: MailboxRow }) {
  const provider = row.provider ? mailboxProviderPresentation(row.provider) : null;
  return (
    <DataTable.Cell
      leading={
        provider
          ? { type: 'icon', icon: <provider.Logo size={PROVIDER_LOGO_PX} role="img" aria-label={provider.label} /> }
          : undefined
      }
      text={row.supportAddress ?? ''}
      secondary={provider?.label}
    />
  );
}

const ticketsLabel = (count: number) => `${count} ${pluralNoun(count, 'ticket')}`;

function StatusCell({ row }: { row: MailboxRow }) {
  const loading = useLoadingScope();
  const tag = row.receivingState ? receivingStateTag(row.receivingState) : null;
  return (
    <div className="flex min-w-0 flex-col items-start justify-center gap-[var(--spacing-system-xxs)]">
      <Tag label={tag?.label ?? ''} variant={tag?.variant} loading={loading} />
      <TruncateText variant="h6" tone="secondary" className={loading ? 'w-28' : undefined}>
        {row.receivingState
          ? receivingStateLine({
              receivingState: row.receivingState,
              lastEmailAt: row.lastEmailAt,
              lastFinishedTestAt: row.lastFinishedTestAt,
            })
          : ''}
      </TruncateText>
    </div>
  );
}

function StatusGridCell({ row }: { row: MailboxRow }) {
  const loading = useLoadingScope();
  const tag = row.receivingState ? receivingStateTag(row.receivingState) : null;
  return (
    <div className="flex min-w-0 items-center">
      <Tag label={tag?.label ?? ''} variant={tag?.variant} loading={loading} />
    </div>
  );
}

/**
 * The columns of the Mailboxes list (Figma 4527-132165): TICKETS sorts on the server (`ticketsCreated`, the last 30
 * days), STATUS filters on the server by receiving state.
 */
export function mailboxColumns(): ColumnDef<MailboxRow>[] {
  return [
    {
      id: MAILBOX_COLUMNS.mailbox.id,
      header: MAILBOX_COLUMNS.mailbox.header,
      cell: ({ row }: { row: Row<MailboxRow> }) => <MailboxCell row={row.original} />,
      enableSorting: false,
      size: 360,
      minSize: GRID_MIN_WIDTH.icon,
      meta: liveColumnMeta(MAILBOX_COLUMNS.mailbox, {
        gridCell: ({ row }: { row: Row<MailboxRow> }) => <MailboxGridCell row={row.original} />,
      }),
    },
    {
      id: MAILBOX_COLUMNS.tickets.id,
      header: MAILBOX_COLUMNS.tickets.header,
      cell: ({ row }: { row: Row<MailboxRow> }) => (
        <TruncateText loading={row.original.ticketsCreated === undefined}>
          {ticketsLabel(row.original.ticketsCreated ?? 0)}
        </TruncateText>
      ),
      enableSorting: false,
      size: 160,
      meta: liveColumnMeta(MAILBOX_COLUMNS.tickets),
    },
    {
      id: MAILBOX_COLUMNS.status.id,
      header: MAILBOX_COLUMNS.status.header,
      accessorFn: (row: MailboxRow) => row.receivingState,
      cell: ({ row }: { row: Row<MailboxRow> }) => <StatusCell row={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 220,
      meta: liveColumnMeta(MAILBOX_COLUMNS.status, {
        filter: { options: RECEIVING_FILTER_OPTIONS },
        gridCell: ({ row }: { row: Row<MailboxRow> }) => <StatusGridCell row={row.original} />,
      }),
    },
    openRowColumn<MailboxRow>(MAILBOX_COLUMNS.open, row => ({
      label: `Open ${row.supportAddress ?? 'mailbox'} in new tab`,
      href: mailboxRowHref(row) ?? undefined,
    })),
  ];
}
