'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { graphql, useMutation } from 'react-relay';
import type { useSaveMailboxUpdateMutation as UpdateMutationType } from '@/__generated__/useSaveMailboxUpdateMutation.graphql';
import { routes } from '@/lib/routes';
import type { StoredBlockListEntry } from '../../utils/block-list-rows';
import { mailboxRequestErrorMessage, mailboxUserErrorMessage } from '../../utils/mailbox-errors';
import { type MailboxSettingsFormData, mailboxDefaultsValues } from '../form/mailbox-defaults';
import { saveBlockList } from './save-block-list';
import { useBlockListMutations } from './use-block-list-mutations';

// Selects what the details page reads, so it shows the saved values on arrival.
const updateMutation = graphql`
  mutation useSaveMailboxUpdateMutation($input: UpdateMailboxInput!) {
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

interface UseSaveMailboxArgs {
  /** Null while the mailbox is read: Save is locked and does nothing. */
  mailboxId: string | null;
  form: UseFormReturn<MailboxSettingsFormData>;
  /** The Block list as read when the page opened. */
  storedEntries: readonly StoredBlockListEntry[];
}

/**
 * Edit Mailbox's Save: the routing defaults, sent whole (`updateMailbox` replaces all three), then the Block list's
 * changes. A refused Block list value is marked on its row and the page stays; a full save goes to the details page.
 */
export function useSaveMailbox({ mailboxId, form, storedEntries }: UseSaveMailboxArgs) {
  const { toast } = useToast();
  const router = useRouter();
  const [commitUpdate, isUpdating] = useMutation<UpdateMutationType>(updateMutation);
  const blockList = useBlockListMutations(mailboxId ?? '');
  // What the Block list holds on the server, as of the last read or save: a save sends the difference.
  const [stored, setStored] = useState(storedEntries);
  const [isSavingBlockList, setSavingBlockList] = useState(false);

  const fail = (description: string) => {
    toast({ title: 'Could not save the mailbox', description, variant: 'destructive' });
  };

  const saveBlockListRows = async (id: string, input: MailboxSettingsFormData) => {
    setSavingBlockList(true);
    const result = await saveBlockList(stored, input.blockList, blockList);
    setSavingBlockList(false);
    setStored(result.stored);
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
      description: 'New tickets from this mailbox use these settings.',
      variant: 'success',
    });
    router.replace(routes.settings.emailToTicket.details(id));
  };

  const save = (input: MailboxSettingsFormData) => {
    if (!mailboxId) return;
    commitUpdate({
      variables: { input: { mailboxId, ...mailboxDefaultsValues(input) } },
      onCompleted: ({ updateMailbox: { userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal) {
          fail(mailboxUserErrorMessage(refusal));
          return;
        }
        void saveBlockListRows(mailboxId, input);
      },
      onError: error => fail(mailboxRequestErrorMessage(error)),
    });
  };

  return { save, busy: isUpdating || isSavingBlockList };
}
