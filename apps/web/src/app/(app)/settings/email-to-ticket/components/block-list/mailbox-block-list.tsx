'use client';

import { TableLayoutScope } from '@/app/components/shared/table-layout-scope';
import { BlockListHeading } from './block-list-heading';
import { BlockListTable } from './block-list-table';

/**
 * Block List of the details page (Figma settings 6236-119872; the grid table under the app's table flag): the senders
 * whose emails this mailbox drops, newest first, who added each and how many emails it dropped in 30 days. The list is
 * changed in Edit Mailbox.
 *
 * The design puts it in a tab beside Tickets on Hold; that tab waits on the backend (contract part D, held emails), so
 * the Block list stands alone until it comes.
 */
export function MailboxBlockList({ mailboxId }: { mailboxId: string }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-m)]">
      <BlockListHeading />
      <TableLayoutScope>
        <BlockListTable mailboxId={mailboxId} />
      </TableLayoutScope>
    </section>
  );
}
