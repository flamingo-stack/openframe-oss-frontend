'use client';

import { graphql, useFragment } from 'react-relay';
import type { invitationDialog_invitation$key } from '@/__generated__/invitationDialog_invitation.graphql';
import { ConfirmRemoveInvitationModal } from './confirm-remove-invitation-modal';
import { ConfirmResendInvitationModal } from './confirm-resend-invitation-modal';
import { ConfirmRevokeInvitationModal } from './confirm-revoke-invitation-modal';
import type { InvitationAction } from './invitation-actions-cell';

const invitationDialogFragment = graphql`
  fragment invitationDialog_invitation on Invitation {
    ...confirmRevokeInvitationModal_invitation
    ...confirmRemoveInvitationModal_invitation
    ...confirmResendInvitationModal_invitation
  }
`;

interface InvitationDialogProps {
  invitation: invitationDialog_invitation$key;
  kind: InvitationAction;
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
}

/** The confirmation an invitation's action opens. */
export function InvitationDialog({ invitation, kind, isOpen, onClose, listingId }: InvitationDialogProps) {
  const data = useFragment(invitationDialogFragment, invitation);
  const props = { invitation: data, isOpen, onClose, listingId };
  switch (kind) {
    case 'revoke':
      return <ConfirmRevokeInvitationModal {...props} />;
    case 'remove':
      return <ConfirmRemoveInvitationModal {...props} />;
    case 'resend':
      return <ConfirmResendInvitationModal {...props} />;
  }
}
