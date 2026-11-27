'use client';

import { graphql, useFragment } from 'react-relay';
import type { invitationDialog_invitation$key } from '@/__generated__/invitationDialog_invitation.graphql';
import { ConfirmResendInvitationModal } from './confirm-resend-invitation-modal';
import { ConfirmRevokeInvitationModal } from './confirm-revoke-invitation-modal';
import type { InvitationAction } from './invitation-actions-cell';

const invitationDialogFragment = graphql`
  fragment invitationDialog_invitation on Invitation {
    ...confirmRevokeInvitationModal_invitation
    ...confirmResendInvitationModal_invitation
  }
`;

interface InvitationDialogProps {
  invitation: invitationDialog_invitation$key;
  kind: InvitationAction;
  isOpen: boolean;
  onClose: () => void;
}

/** The confirmation an invitation's action opens. */
export function InvitationDialog({ invitation, kind, isOpen, onClose }: InvitationDialogProps) {
  const data = useFragment(invitationDialogFragment, invitation);
  if (kind === 'resend') {
    return <ConfirmResendInvitationModal invitation={data} isOpen={isOpen} onClose={onClose} />;
  }
  return <ConfirmRevokeInvitationModal invitation={data} kind={kind} isOpen={isOpen} onClose={onClose} />;
}
