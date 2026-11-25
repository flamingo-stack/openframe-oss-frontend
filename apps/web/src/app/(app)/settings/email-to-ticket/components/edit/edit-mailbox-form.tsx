'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { editMailboxForm_mailbox$key } from '@/__generated__/editMailboxForm_mailbox.graphql';
import type { editMailboxFormMutation as UpdateMutationType } from '@/__generated__/editMailboxFormMutation.graphql';
import { routes } from '@/lib/routes';
import { mailboxRequestErrorMessage, mailboxUserErrorMessage } from '../../utils/mailbox-errors';
import {
  EMPTY_MAILBOX_DEFAULTS,
  type MailboxDefaultsFormData,
  mailboxDefaultsSchema,
  toStoredDefaults,
} from '../form/mailbox-defaults';
import { MailboxDefaultsFields } from '../form/mailbox-defaults-fields';
import { MailboxPageFrame, SAVE_MAILBOX_ACTION } from '../shared/mailbox-page-frame';

export const EDIT_MAILBOX_TITLE = 'Edit Mailbox';

const editMailboxFormFragment = graphql`
  fragment editMailboxForm_mailbox on Mailbox {
    id
    ...mailboxDefaults_mailbox
  }
`;

// Selects what the details page reads, so it shows the saved values on arrival.
const updateMutation = graphql`
  mutation editMailboxFormMutation($input: UpdateMailboxInput!) {
    updateMailbox(input: $input) {
      mailbox {
        id
        ...mailboxSummaryCard_mailbox
        ...editMailboxForm_mailbox
      }
      userErrors {
        ...mailboxErrors_userError
      }
    }
  }
`;

/**
 * The routing defaults of a saved mailbox, sent whole on Save. With no mailbox (the record is still being read, or the
 * page is on its way elsewhere) it is the same form, locked: nothing fetches and nothing submits.
 */
export function EditMailboxForm({ mailbox }: { mailbox: editMailboxForm_mailbox$key | null }) {
  const data = useFragment(editMailboxFormFragment, mailbox);
  const stored = data ? toStoredDefaults(data) : null;
  const { toast } = useToast();
  const router = useRouter();
  const [commit, isSaving] = useMutation<UpdateMutationType>(updateMutation);
  const form = useForm<MailboxDefaultsFormData>({
    resolver: zodResolver(mailboxDefaultsSchema),
    defaultValues: stored?.values ?? EMPTY_MAILBOX_DEFAULTS,
  });

  const fail = (description: string) => {
    toast({ title: 'Could not save the mailbox', description, variant: 'destructive' });
  };

  const save = form.handleSubmit(input => {
    if (!data) return;
    commit({
      // Every value is sent: null clears a default (contract part A, `updateMailbox` replaces all three).
      variables: { input: { mailboxId: data.id, ...input } },
      onCompleted: ({ updateMailbox: { userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal) {
          fail(mailboxUserErrorMessage(refusal));
          return;
        }
        toast({
          title: 'Mailbox saved',
          description: 'New tickets from this mailbox use these defaults.',
          variant: 'success',
        });
        router.replace(routes.settings.emailToTicket.details(data.id));
      },
      onError: error => fail(mailboxRequestErrorMessage(error)),
    });
  });

  return (
    <MailboxPageFrame
      title={EDIT_MAILBOX_TITLE}
      actions={[{ ...SAVE_MAILBOX_ACTION, disabled: !data || isSaving, loading: isSaving, onClick: save }]}
    >
      <MailboxDefaultsFields
        control={form.control}
        setValue={form.setValue}
        disabled={!data || isSaving}
        stored={stored?.options}
      />
    </MailboxPageFrame>
  );
}
