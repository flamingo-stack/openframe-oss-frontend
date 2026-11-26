'use client';

import { TableLayoutScope } from '@/app/components/shared/table-layout-scope';
import { BlockListTable } from './block-list-table';

/**
 * Block List of the details page (Figma settings 6236-119872, the grid table under the app's table flag): the senders whose emails this mailbox drops, newest first, with
 * who added each and how many emails it dropped in 30 days. The list is changed in Edit Mailbox.
 *
 * The design puts it in a tab beside Tickets on Hold; that tab waits on the backend (contract part D, held emails), so
 * the Block list stands alone until it comes.
 */
export function MailboxBlockList({ mailboxId }: { mailboxId: string }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-m)]">
      <div className="flex flex-col">
        <h2 className="text-ods-text-primary text-h2">Block List</h2>
        <p className="text-ods-text-secondary text-h6">
          Emails from these addresses and domains are dropped. They never become tickets.
        </p>
      </div>
      <TableLayoutScope>
        <BlockListTable mailboxId={mailboxId} />
      </TableLayoutScope>
    </section>
  );
}
