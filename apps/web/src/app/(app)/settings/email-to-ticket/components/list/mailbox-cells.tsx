'use client';

import { DataTable, Tag, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { pluralNoun } from '@/lib/pluralize';
import { mailboxProviderPresentation, receivingStateLine, receivingStateTag } from '../../utils/mailbox-presentation';
import type { MailboxRow } from './mailbox-row';

// A loading scope's rows are placeholders that carry their `id` alone: a cell draws from what the row has.

const PROVIDER_LOGO_PX = 20;

/** MAILBOX in card rows: the provider's mark and the address, the provider under it. */
export function MailboxCell({ row }: { row: MailboxRow }) {
  const loading = useLoadingScope();
  const provider = row.provider ? mailboxProviderPresentation(row.provider) : null;
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        {provider && (
          <provider.Logo data-loading-optional size={PROVIDER_LOGO_PX} role="img" aria-label={provider.label} />
        )}
        <TruncateText className={loading ? 'w-48' : undefined}>{row.supportAddress}</TruncateText>
      </div>
      <TruncateText variant="h6" tone="secondary" className={loading ? 'w-24' : undefined}>
        {provider?.label ?? ''}
      </TruncateText>
    </div>
  );
}

/** MAILBOX in the grid layout: one line, the provider's mark, the address, then the provider. */
export function MailboxGridCell({ row }: { row: MailboxRow }) {
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

export function TicketsCell({ row }: { row: MailboxRow }) {
  const loading = useLoadingScope();
  const count = loading ? 0 : row.stats.ticketsCreated;
  return <TruncateText loading={loading}>{`${count} ${pluralNoun(count, 'ticket')}`}</TruncateText>;
}

/** STATUS: the receiving state's tag; card rows add when the last email came (or the test failed) under it. */
export function StatusCell({ row, withLine }: { row: MailboxRow; withLine: boolean }) {
  const loading = useLoadingScope();
  const tag = row.receivingState ? receivingStateTag(row.receivingState) : null;
  return (
    <div className="flex min-w-0 flex-col items-start justify-center gap-[var(--spacing-system-xxs)]">
      <Tag label={tag?.label ?? ''} variant={tag?.variant} loading={loading} />
      {withLine && (
        <TruncateText variant="h6" tone="secondary" className={loading ? 'w-28' : undefined}>
          {row.receivingState ? receivingStateLine(row) : ''}
        </TruncateText>
      )}
    </div>
  );
}
