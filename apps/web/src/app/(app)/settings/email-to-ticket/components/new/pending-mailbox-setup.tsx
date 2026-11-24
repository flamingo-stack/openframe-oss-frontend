'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { LoadingScope, NotFoundError, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { pendingMailboxSetupQuery as PendingMailboxSetupQueryType } from '@/__generated__/pendingMailboxSetupQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { MailboxReceivingState } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { NewMailboxFrame } from './new-mailbox-frame';
import { NewMailboxForm } from './new-mailbox-view';
import { PendingMailboxForm } from './pending-mailbox-form';

// Generate selects the same fields and links this root field to its record, so the step starts from the store.
const pendingMailboxSetupQuery = graphql`
  query pendingMailboxSetupQuery($id: ID!) {
    mailbox(id: $id) {
      id
      receivingState
      ...pendingMailboxForm_mailbox
    }
  }
`;

/**
 * `/settings/email-to-ticket/new?id=` once Generate created the Pending mailbox: its forwarding address, the routing
 * defaults and Save Mailbox. Own boundary: in its scope the reader draws the first step's locked form.
 */
export function PendingMailboxSetup({ id }: { id: string }) {
  return (
    <LoadingSuspense live label="Loading mailbox">
      <PendingMailboxSetupReader id={id} />
    </LoadingSuspense>
  );
}

function PendingMailboxSetupReader({ id }: { id: string }) {
  if (useLoadingScope()) return <NewMailboxForm />;
  return <PendingMailboxSetupQuery id={id} />;
}

function PendingMailboxSetupQuery({ id }: { id: string }) {
  const router = useRouter();
  const retryKey = useRetryKey();
  const { mailbox } = useLazyLoadQuery<PendingMailboxSetupQueryType>(
    pendingMailboxSetupQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const saved = mailbox != null && mailbox.receivingState !== MailboxReceivingState.PENDING;
  // A saved mailbox has no setup left: its page is the details page (a Back into history, a reload after Save).
  useEffect(() => {
    if (saved) router.replace(routes.settings.emailToTicket.details(id));
  }, [saved, id, router]);

  if (!mailbox) {
    return (
      <NewMailboxFrame>
        <NotFoundError message="Mailbox not found" onHome={() => router.replace(routes.settings.emailToTicket.list)} />
      </NewMailboxFrame>
    );
  }
  // On its way to the details page: the locked form, not a blank page.
  if (saved) {
    return (
      <LoadingScope>
        <NewMailboxForm />
      </LoadingScope>
    );
  }
  return <PendingMailboxForm key={mailbox.id} mailbox={mailbox} />;
}
