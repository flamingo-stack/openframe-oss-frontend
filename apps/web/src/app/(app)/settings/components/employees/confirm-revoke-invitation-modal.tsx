'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { confirmRevokeInvitationModal_invitation$key } from '@/__generated__/confirmRevokeInvitationModal_invitation.graphql';
import type { confirmRevokeInvitationModalMutation } from '@/__generated__/confirmRevokeInvitationModalMutation.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { decrementInvitationsCount } from './invitations-listing';

const confirmRevokeInvitationModalFragment = graphql`
  fragment confirmRevokeInvitationModal_invitation on Invitation {
    id
    email
  }
`;

const confirmRevokeInvitationModalMutationNode = graphql`
  mutation confirmRevokeInvitationModalMutation($id: ID!, $connections: [ID!]!) {
    revokeInvitation(input: { id: $id }) {
      revokedInvitationId @deleteEdge(connections: $connections)
    }
  }
`;

interface ConfirmRevokeInvitationModalProps {
  invitation: confirmRevokeInvitationModal_invitation$key;
  isOpen: boolean;
  onClose: () => void;
  /** The block's connection on screen. */
  listingId: string;
}

/** Revokes a pending invitation; its row leaves the block at once. */
export function ConfirmRevokeInvitationModal({
  invitation,
  isOpen,
  onClose,
  listingId,
}: ConfirmRevokeInvitationModalProps) {
  const { toast } = useToast();
  const { id, email } = useFragment(confirmRevokeInvitationModalFragment, invitation);
  const [commit, isInFlight] = useMutation<confirmRevokeInvitationModalMutation>(
    confirmRevokeInvitationModalMutationNode,
  );

  const handleConfirm = () => {
    commit({
      variables: { id, connections: [listingId] },
      updater: store => decrementInvitationsCount(store, listingId),
      onCompleted: onClose,
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to revoke invitation'),
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
      title="Revoke Invitation"
      description={
        <>
          This will permanently delete the invitation for <span className="text-ods-error">{email}</span>. The user will
          no longer be able to register using this invite.
        </>
      }
      confirmLabel="Revoke Invitation"
      isPending={isInFlight}
      onConfirm={handleConfirm}
    />
  );
}
