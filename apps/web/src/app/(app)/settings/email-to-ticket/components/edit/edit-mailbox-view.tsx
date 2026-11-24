'use client';
'use no memo';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { NotFoundError, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { editMailboxViewQuery as EditMailboxViewQueryType } from '@/__generated__/editMailboxViewQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { MailboxReceivingState } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { EMPTY_MAILBOX_DEFAULTS, type MailboxDefaultsFormData } from '../form/mailbox-defaults';
import { MailboxDefaultsFields } from '../form/mailbox-defaults-fields';
import { MailboxPageFrame, SAVE_MAILBOX_ACTION } from '../shared/mailbox-page-frame';
import { EDIT_MAILBOX_TITLE, EditMailboxForm } from './edit-mailbox-form';

const editMailboxViewQuery = graphql`
  query editMailboxViewQuery($id: ID!) {
    mailbox(id: $id) {
      id
      receivingState
      ...editMailboxForm_mailbox
    }
  }
`;

/**
 * `/settings/email-to-ticket/edit?id=` (Figma 4679-130269): the routing defaults of new tickets.
 *
 * Not drawn yet, waiting on the backend: the send-only sign-in card (`startSendAsSignIn` / `signOutSendAs` answer
 * NOT_IMPLEMENTED until CU-17tkuw66n95) and the Block List (its storage is CU-17tkuw66n9x).
 */
export function EditMailboxView({ id, loading = false }: { id: string; loading?: boolean }) {
  return (
    <LoadingSuspense live label="Loading mailbox" gated={loading}>
      <EditMailboxReader id={id} />
    </LoadingSuspense>
  );
}

function EditMailboxReader({ id }: { id: string }) {
  if (useLoadingScope()) return <LoadingEditForm />;
  return <EditMailboxQuery id={id} />;
}

/** While the record is read: the real fields over an empty form, locked; nothing fetches and nothing submits. */
function LoadingEditForm() {
  const form = useForm<MailboxDefaultsFormData>({ defaultValues: EMPTY_MAILBOX_DEFAULTS });
  return (
    <MailboxPageFrame title={EDIT_MAILBOX_TITLE} actions={[SAVE_MAILBOX_ACTION]}>
      <MailboxDefaultsFields control={form.control} setValue={form.setValue} disabled />
    </MailboxPageFrame>
  );
}

function EditMailboxQuery({ id }: { id: string }) {
  const router = useRouter();
  const retryKey = useRetryKey();
  const { mailbox } = useLazyLoadQuery<EditMailboxViewQueryType>(
    editMailboxViewQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const pending = mailbox?.receivingState === MailboxReceivingState.PENDING;
  useEffect(() => {
    if (pending) router.replace(routes.settings.emailToTicket.new({ id }));
  }, [pending, id, router]);

  if (!mailbox) {
    return (
      <MailboxPageFrame title={EDIT_MAILBOX_TITLE}>
        <NotFoundError message="Mailbox not found" onHome={() => router.replace(routes.settings.emailToTicket.list)} />
      </MailboxPageFrame>
    );
  }
  // On its way to the setup page: the form as it loads, not a blank page.
  if (pending) return <LoadingEditForm />;
  return <EditMailboxForm key={mailbox.id} mailbox={mailbox} />;
}
