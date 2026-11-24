'use client';

import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { EDIT_MAILBOX_TITLE } from '../components/edit/edit-mailbox-form';
import { EditMailboxView } from '../components/edit/edit-mailbox-view';
import { EmailToTicketPageShell } from '../components/shared/email-to-ticket-page-shell';

export default function EditMailboxPage() {
  const id = useRequiredIdParam(routes.settings.emailToTicket.list);
  if (!id) {
    return null;
  }
  return (
    <EmailToTicketPageShell title={EDIT_MAILBOX_TITLE} errorMessage="Couldn't load this mailbox." resetKey={id}>
      {loading => <EditMailboxView key={id} id={id} loading={loading} />}
    </EmailToTicketPageShell>
  );
}
