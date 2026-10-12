'use client';

import { PlusCircleIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type React from 'react';
import { useState } from 'react';
import { graphql, useMutation } from 'react-relay';
import type { addUsersModalMutation } from '@/__generated__/addUsersModalMutation.graphql';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { invalidateInvitationsListings } from './employees/invitations-listing';
import { describeInviteRefusals, refusedEmailIndexes } from './employees/invite-refusals';

const addUsersModalMutationNode = graphql`
  mutation addUsersModalMutation($emails: [String!]!) {
    inviteUsers(input: { emails: $emails }) {
      userErrors {
        field
        message
      }
    }
  }
`;

type InviteRow = { email: string; role: string };

/** A first pass so an obvious typo never leaves the form; the server's check is the one that counts. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_OPTIONS = [{ value: 'ADMIN', label: 'Admin' }];

interface AddUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The invitations listings on screen, refetched with the new invitations. */
  listingIds: readonly string[];
}

export function AddUsersModal({ isOpen, onClose, listingIds }: AddUsersModalProps) {
  const [rows, setRows] = useState<InviteRow[]>([{ email: '', role: 'ADMIN' }]);
  const [commit, isSubmitting] = useMutation<addUsersModalMutation>(addUsersModalMutationNode);
  const { toast } = useToast();

  const canSubmit = rows.some(r => EMAIL_PATTERN.test(r.email.trim()));

  // Cleared on the close transition, during render rather than in an effect: an
  // effect leaves the old values on screen for a frame of the closing animation.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setRows([{ email: '', role: 'ADMIN' }]);
    }
  }

  const setRow = (idx: number, patch: Partial<InviteRow>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows(prev => [...prev, { email: '', role: 'ADMIN' }]);
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    if (!canSubmit) return;
    const emails = rows.map(r => r.email.trim()).filter(email => EMAIL_PATTERN.test(email));
    if (emails.length === 0) return;
    commit({
      variables: { emails },
      // A partial failure still sent the rest, so the listings refetch either way.
      updater: store => invalidateInvitationsListings(store, listingIds),
      onCompleted: ({ inviteUsers: { userErrors } }) => {
        const refused = describeInviteRefusals(emails, userErrors);
        if (!refused) {
          toast({ title: 'Invites sent', description: `${emails.length} user(s) invited`, variant: 'success' });
          onClose();
          return;
        }
        // The sent ones leave the form, so fixing a refused row and sending again
        // does not invite the rest a second time.
        const refusedIndexes = refusedEmailIndexes(userErrors);
        const sent = new Set(emails.filter((_, index) => !refusedIndexes.has(index)));
        setRows(prev => prev.filter(row => !sent.has(row.email.trim())));
        toast({
          title: sent.size > 0 ? `${sent.size} of ${emails.length} invites sent` : 'Invite failed',
          description: refused,
          variant: 'destructive',
        });
      },
      onError: error => {
        toast({
          title: 'Invite failed',
          description: getRelayErrorMessage(error, 'Failed to send invites'),
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-2xl"
      title="Add Employees"
      contentClassName="flex flex-col gap-[var(--spacing-system-l)]"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send Invites'}
          </Button>
        </>
      }
    >
      <p className="text-ods-text-primary text-h4">
        Enter the emails of the users you want to add to the system, we will send them invitations to register.
      </p>

      <div className="flex flex-col gap-[var(--spacing-system-xs)]">
        <div className="grid grid-cols-2 gap-2">
          <Label>User Email</Label>
          <Label>Role</Label>
        </div>

        {rows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-2 items-center gap-2">
            <Input
              placeholder="Enter Email Here"
              value={row.email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRow(idx, { email: e.target.value })}
              invalid={row.email.length > 0 && !EMAIL_PATTERN.test(row.email)}
            />
            <div className="flex items-center gap-2">
              <Select value={row.role} onValueChange={v => setRow(idx, { role: v })}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {rows.length > 1 && (
                <Button variant="outline" size="icon" onClick={() => removeRow(idx)} className="shrink-0">
                  <TrashIcon className="size-5 text-ods-error" />
                </Button>
              )}
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="small"
          className="self-start"
          onClick={addRow}
          leftIcon={<PlusCircleIcon size={24} className="text-ods-text-primary" />}
        >
          Add More Users
        </Button>
      </div>
    </SimpleModal>
  );
}
