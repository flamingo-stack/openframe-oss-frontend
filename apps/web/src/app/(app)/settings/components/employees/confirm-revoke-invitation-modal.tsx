'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { confirmRevokeInvitationModal_invitation$key } from '@/__generated__/confirmRevokeInvitationModal_invitation.graphql';
import type { confirmRevokeInvitationModalMutation } from '@/__generated__/confirmRevokeInvitationModalMutation.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { markListChanged } from '@/lib/list-refresh';

const confirmRevokeInvitationModalFragment = graphql`
  fragment confirmRevokeInvitationModal_invitation on Invitation {
    id
    email
  }
`;

const confirmRevokeInvitationModalMutationNode = graphql`
  mutation confirmRevokeInvitationModalMutation($id: ID!) {
    revokeInvitation(input: { id: $id }) {
      revokedInvitationId
    }
  }
`;

/** Revoking a pending invitation and removing an expired one are the same call, worded for each. */
const WORDING = {
  revoke: {
    title: 'Revoke Invitation',
    before: 'This will permanently delete the invitation for',
    after: '. The user will no longer be able to register using this invite.',
    failure: 'Failed to revoke invitation',
  },
  remove: {
    title: 'Remove Invitation',
    before: 'This will permanently delete the expired invitation for',
    after: ' from your list.',
    failure: 'Failed to remove invitation',
  },
};

interface ConfirmRevokeInvitationModalProps {
  invitation: confirmRevokeInvitationModal_invitation$key;
  kind: keyof typeof WORDING;
  isOpen: boolean;
  onClose: () => void;
}

/** Revokes an invitation; the invitations list reads its page again (the row and the counts are the server's). */
export function ConfirmRevokeInvitationModal({ invitation, kind, isOpen, onClose }: ConfirmRevokeInvitationModalProps) {
  const { toast } = useToast();
  const { id, email } = useFragment(confirmRevokeInvitationModalFragment, invitation);
  const [commit, isInFlight] = useMutation<confirmRevokeInvitationModalMutation>(
    confirmRevokeInvitationModalMutationNode,
  );
  const wording = WORDING[kind];

  const handleConfirm = () => {
    commit({
      variables: { id },
      onCompleted: () => {
        markListChanged('invitations');
        onClose();
      },
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, wording.failure),
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
      title={wording.title}
      description={
        <>
          {wording.before} <span className="text-ods-error">{email}</span>
          {wording.after}
        </>
      }
      confirmLabel={wording.title}
      isPending={isInFlight}
      onConfirm={handleConfirm}
    />
  );
}
