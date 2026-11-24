'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSearchParams } from 'next/navigation';
import { NEW_MAILBOX_TITLE } from '../components/new/new-mailbox-frame';
import { NewMailboxForm } from '../components/new/new-mailbox-view';
import { PendingMailboxSetup } from '../components/new/pending-mailbox-setup';
import { EmailToTicketPageShell } from '../components/shared/email-to-ticket-page-shell';

export default function NewMailboxPage() {
  // Set once Generate has created the Pending mailbox: the page is then its setup step, and a reload or Back resumes it.
  const mailboxId = useSearchParams().get('id');
  return (
    <EmailToTicketPageShell
      title={NEW_MAILBOX_TITLE}
      errorMessage="Couldn't load the mailbox setup."
      resetKey={mailboxId ?? undefined}
    >
      {loading => (
        <LoadingWhen loading={loading}>
          {/* Keyed by id: another mailbox is another form. */}
          {mailboxId ? <PendingMailboxSetup key={mailboxId} id={mailboxId} /> : <NewMailboxForm />}
        </LoadingWhen>
      )}
    </EmailToTicketPageShell>
  );
}
