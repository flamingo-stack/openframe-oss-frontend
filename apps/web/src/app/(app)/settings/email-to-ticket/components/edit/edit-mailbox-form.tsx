'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { editMailboxForm_blockList$key } from '@/__generated__/editMailboxForm_blockList.graphql';
import type { editMailboxForm_mailbox$key } from '@/__generated__/editMailboxForm_mailbox.graphql';
import type { editMailboxFormMutation as UpdateMutationType } from '@/__generated__/editMailboxFormMutation.graphql';
import { routes } from '@/lib/routes';
import { mailboxRequestErrorMessage, mailboxUserErrorMessage } from '../../utils/mailbox-errors';
import { BlockListFields } from '../form/block-list-fields';
import {
  EMPTY_MAILBOX_SETTINGS,
  type MailboxSettingsFormData,
  mailboxDefaultsValues,
  mailboxSettingsSchema,
  toStoredDefaults,
} from '../form/mailbox-defaults';
import { MailboxDefaultsFields } from '../form/mailbox-defaults-fields';
import { MailboxPageFrame, SAVE_MAILBOX_ACTION } from '../shared/mailbox-page-frame';
import { blockListRowsOf, saveBlockList } from './save-block-list';

export const EDIT_MAILBOX_TITLE = 'Edit Mailbox';

const editMailboxFormFragment = graphql`
  fragment editMailboxForm_mailbox on Mailbox {
    id
    ...mailboxDefaults_mailbox
  }
`;

// The stored Block list (contract part D, newest first): the first 100, the most one page holds. Entries past them are
// not shown here and a save leaves them as they are.
const editMailboxFormBlockListFragment = graphql`
  fragment editMailboxForm_blockList on EmailBlockListEntryConnection {
    edges {
      node {
        id
        value
      }
    }
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

interface EditMailboxFormProps {
  mailbox: editMailboxForm_mailbox$key | null;
  blockList: editMailboxForm_blockList$key | null;
}

/**
 * The routing defaults of a saved mailbox, sent whole on Save, then the Block list's changes, entry by entry. With no
 * mailbox (the record is still being read, or the page is on its way elsewhere) it is the same form, locked: nothing
 * fetches and nothing submits.
 */
export function EditMailboxForm({ mailbox, blockList }: EditMailboxFormProps) {
  const data = useFragment(editMailboxFormFragment, mailbox);
  const blockListData = useFragment(editMailboxFormBlockListFragment, blockList);
  const stored = data ? toStoredDefaults(data) : null;
  const { toast } = useToast();
  const router = useRouter();
  const [commit, isSaving] = useMutation<UpdateMutationType>(updateMutation);
  // What the Block list holds on the server, as of the last read or save: a save sends the difference.
  const [storedEntries, setStoredEntries] = useState(
    () => blockListData?.edges.map(({ node }) => ({ id: node.id, value: node.value })) ?? [],
  );
  const [isSavingBlockList, setSavingBlockList] = useState(false);
  const busy = isSaving || isSavingBlockList;
  const form = useForm<MailboxSettingsFormData>({
    resolver: zodResolver(mailboxSettingsSchema),
    defaultValues: stored ? { ...stored.values, blockList: blockListRowsOf(storedEntries) } : EMPTY_MAILBOX_SETTINGS,
  });

  const fail = (description: string) => {
    toast({ title: 'Could not save the mailbox', description, variant: 'destructive' });
  };

  const saveSenders = async (mailboxId: string, input: MailboxSettingsFormData) => {
    setSavingBlockList(true);
    const result = await saveBlockList(mailboxId, storedEntries, input.blockList);
    setSavingBlockList(false);
    setStoredEntries(result.stored);
    form.setValue('blockList', result.rows);
    if (result.error) {
      fail(result.error);
      return;
    }
    if (result.rowErrors.length > 0) {
      for (const { index, message } of result.rowErrors) form.setError(`blockList.${index}.value`, { message });
      fail('Some senders were not added to the Block list. Fix them and save again.');
      return;
    }
    toast({
      title: 'Mailbox saved',
      description: 'New tickets from this mailbox use these defaults.',
      variant: 'success',
    });
    router.replace(routes.settings.emailToTicket.details(mailboxId));
  };

  const save = form.handleSubmit(input => {
    if (!data) return;
    commit({
      // Every value is sent: null clears a default (contract part A, `updateMailbox` replaces all three).
      variables: { input: { mailboxId: data.id, ...mailboxDefaultsValues(input) } },
      onCompleted: ({ updateMailbox: { userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal) {
          fail(mailboxUserErrorMessage(refusal));
          return;
        }
        void saveSenders(data.id, input);
      },
      onError: error => fail(mailboxRequestErrorMessage(error)),
    });
  });

  return (
    <MailboxPageFrame
      title={EDIT_MAILBOX_TITLE}
      actions={[{ ...SAVE_MAILBOX_ACTION, disabled: !data || busy, loading: busy, onClick: save }]}
    >
      <MailboxDefaultsFields
        control={form.control}
        setValue={form.setValue}
        disabled={!data || busy}
        stored={stored?.options}
      />
      <BlockListFields control={form.control} disabled={!data || busy} />
    </MailboxPageFrame>
  );
}
