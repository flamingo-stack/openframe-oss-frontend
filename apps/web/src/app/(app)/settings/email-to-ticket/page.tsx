'use client';

import { EMAIL_TO_TICKET_TITLE, MailboxesView } from './components/list/mailboxes-view';
import { EmailToTicketPageShell } from './components/shared/email-to-ticket-page-shell';

export default function EmailToTicketPage() {
  return (
    <EmailToTicketPageShell title={EMAIL_TO_TICKET_TITLE} errorMessage="Couldn't load the mailboxes.">
      {loading => <MailboxesView loading={loading} />}
    </EmailToTicketPageShell>
  );
}
