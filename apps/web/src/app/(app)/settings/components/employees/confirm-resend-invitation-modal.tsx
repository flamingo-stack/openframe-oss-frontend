'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { confirmResendInvitationModal_invitation$key } from '@/__generated__/confirmResendInvitationModal_invitation.graphql';
import type { confirmResendInvitationModalMutation } from '@/__generated__/confirmResendInvitationModalMutation.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { invalidateInvitationsListings } from './invitations-listing';

const confirmResendInvitationModalFragment = graphql`
  fragment confirmResendInvitationModal_invitation on Invitation {
    id
    email
  }
`;

const confirmResendInvitationModalMutationNode = graphql`
  mutation confirmResendInvitationModalMutation($id: ID!, $connections: [ID!]!) {
    resendInvitation(input: { id: $id }) {
      revokedInvitationId @deleteEdge(connections: $connections)
      invitationEdge {
        node {
          id
        }
      }
    }
  }
`;

interface ConfirmResendInvitationModalProps {
  invitation: confirmResendInvitationModal_invitation$key;
  isOpen: boolean;
  onClose: () => void;
  /** The block's connection on screen. */
  listingId: string;
}

/**
 * Replaces an expired invitation with a new one. The old row leaves at once; the
 * block refetches for the new one, which the server sorts.
 */
export function ConfirmResendInvitationModal({
  invitation,
  isOpen,
  onClose,
  listingId,
}: ConfirmResendInvitationModalProps) {
  const { toast } = useToast();
  const { id, email } = useFragment(confirmResendInvitationModalFragment, invitation);
  const [commit, isInFlight] = useMutation<confirmResendInvitationModalMutation>(
    confirmResendInvitationModalMutationNode,
  );

  const handleConfirm = () => {
    commit({
      variables: { id, connections: [listingId] },
      updater: store => invalidateInvitationsListings(store, [listingId]),
      onCompleted: onClose,
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to resend invitation'),
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
      title="Resend Invitation"
      description={
        <>
          This will send a new invitation to <span className="text-ods-warning">{email}</span> and invalidate the
          previous one. The user must use the new invitation to register.
        </>
      }
      confirmLabel="Resend Invitation"
      variant="warning"
      isPending={isInFlight}
      onConfirm={handleConfirm}
    />
  );
}
