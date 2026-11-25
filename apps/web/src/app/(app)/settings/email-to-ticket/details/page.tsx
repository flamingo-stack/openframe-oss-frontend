'use client';

import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { MAILBOX_DETAIL_TITLE, MailboxDetailView } from '../components/details/mailbox-detail-view';
import { EmailToTicketPageShell } from '../components/shared/email-to-ticket-page-shell';

export default function MailboxDetailsPage() {
  // `?id=` missing → the list. Null while redirecting.
  const id = useRequiredIdParam(routes.settings.emailToTicket.list);
  if (!id) {
    return null;
  }
  return (
    <EmailToTicketPageShell title={MAILBOX_DETAIL_TITLE} errorMessage="Couldn't load this mailbox." resetKey={id}>
      {/* Keyed by id: the router reuses this segment when only `?id=` changes. */}
      {loading => <MailboxDetailView key={id} id={id} loading={loading} />}
    </EmailToTicketPageShell>
  );
}
