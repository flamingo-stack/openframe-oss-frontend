'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { confirmRemoveInvitationModal_invitation$key } from '@/__generated__/confirmRemoveInvitationModal_invitation.graphql';
import type { confirmRemoveInvitationModalMutation } from '@/__generated__/confirmRemoveInvitationModalMutation.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { decrementInvitationsCount } from './invitations-listing';

const confirmRemoveInvitationModalFragment = graphql`
  fragment confirmRemoveInvitationModal_invitation on Invitation {
    id
    email
  }
`;

const confirmRemoveInvitationModalMutationNode = graphql`
  mutation confirmRemoveInvitationModalMutation($id: ID!, $connections: [ID!]!) {
    revokeInvitation(input: { id: $id }) {
      revokedInvitationId @deleteEdge(connections: $connections)
    }
  }
`;

interface ConfirmRemoveInvitationModalProps {
  invitation: confirmRemoveInvitationModal_invitation$key;
  isOpen: boolean;
  onClose: () => void;
  /** The block's connection on screen. */
  listingId: string;
}

/** Removes an expired invitation (the same revoke, worded for one that can no longer be used). */
export function ConfirmRemoveInvitationModal({
  invitation,
  isOpen,
  onClose,
  listingId,
}: ConfirmRemoveInvitationModalProps) {
  const { toast } = useToast();
  const { id, email } = useFragment(confirmRemoveInvitationModalFragment, invitation);
  const [commit, isInFlight] = useMutation<confirmRemoveInvitationModalMutation>(
    confirmRemoveInvitationModalMutationNode,
  );

  const handleConfirm = () => {
    commit({
      variables: { id, connections: [listingId] },
      updater: store => decrementInvitationsCount(store, listingId),
      onCompleted: onClose,
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to remove invitation'),
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title="Remove Invitation"
      description={
        <>
          This will permanently delete the expired invitation for <span className="text-ods-error">{email}</span> from
          your list.
        </>
      }
      confirmLabel="Remove Invitation"
      isPending={isInFlight}
      onConfirm={handleConfirm}
    />
  );
}
