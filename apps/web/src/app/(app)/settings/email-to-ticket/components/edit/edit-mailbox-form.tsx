'use client';
'use no memo';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { graphql, useFragment } from 'react-relay';
import type { editMailboxForm_blockList$key } from '@/__generated__/editMailboxForm_blockList.graphql';
import type { editMailboxForm_mailbox$key } from '@/__generated__/editMailboxForm_mailbox.graphql';
import { blockListRowsOf } from '../../utils/block-list-rows';
import { BlockListFields } from '../form/block-list-fields';
import {
  EMPTY_MAILBOX_SETTINGS,
  type MailboxSettingsFormData,
  mailboxSettingsSchema,
  toStoredDefaults,
} from '../form/mailbox-defaults';
import { MailboxDefaultsFields } from '../form/mailbox-defaults-fields';
import { MailboxPageFrame, SAVE_MAILBOX_ACTION } from '../shared/mailbox-page-frame';
import { useSaveMailbox } from './use-save-mailbox';

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

interface EditMailboxFormProps {
  mailbox: editMailboxForm_mailbox$key | null;
  blockList: editMailboxForm_blockList$key | null;
}

/**
 * Edit Mailbox (Figma settings 6236-120311): the routing defaults and the Block list of a saved mailbox. With no mailbox
 * (the record is still being read, or the page is on its way elsewhere) it is the same form, locked: nothing fetches
 * and nothing submits.
 */
export function EditMailboxForm({ mailbox, blockList }: EditMailboxFormProps) {
  const data = useFragment(editMailboxFormFragment, mailbox);
  const blockListData = useFragment(editMailboxFormBlockListFragment, blockList);
  const stored = data ? toStoredDefaults(data) : null;
  const storedEntries = blockListData?.edges.map(({ node }) => ({ id: node.id, value: node.value })) ?? [];
  const form = useForm<MailboxSettingsFormData>({
    resolver: zodResolver(mailboxSettingsSchema),
    defaultValues: stored ? { ...stored.values, blockList: blockListRowsOf(storedEntries) } : EMPTY_MAILBOX_SETTINGS,
  });
  const { save, busy } = useSaveMailbox({ mailboxId: data?.id ?? null, form, storedEntries });
  const locked = !data || busy;

  return (
    <MailboxPageFrame
      title={EDIT_MAILBOX_TITLE}
      actions={[{ ...SAVE_MAILBOX_ACTION, disabled: locked, loading: busy, onClick: form.handleSubmit(save) }]}
    >
      <MailboxDefaultsFields
        control={form.control}
        setValue={form.setValue}
        disabled={locked}
        stored={stored?.options}
      />
      <BlockListFields control={form.control} disabled={locked} />
    </MailboxPageFrame>
  );
}
