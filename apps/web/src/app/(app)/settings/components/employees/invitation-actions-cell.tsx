'use client';

import { MoreActionsMenu } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { invitationActionsCell_invitation$key } from '@/__generated__/invitationActionsCell_invitation.graphql';
import { InvitationStatus } from '@/generated/schema-enums';

const invitationActionsCellFragment = graphql`
  fragment invitationActionsCell_invitation on Invitation {
    status
  }
`;

export type InvitationAction = 'revoke' | 'resend' | 'remove';

interface InvitationActionsCellProps {
  invitation: invitationActionsCell_invitation$key;
  /** The table opens the dialog — see `useRowDialog` for why it is not the row's. */
  onAction: (action: InvitationAction) => void;
}

/** A pending invitation can be revoked; an expired one resent or removed. */
export function InvitationActionsCell({ invitation, onAction }: InvitationActionsCellProps) {
  const { status } = useFragment(invitationActionsCellFragment, invitation);
  const items =
    status === InvitationStatus.EXPIRED
      ? [
          { label: 'Resend', onClick: () => onAction('resend') },
          { label: 'Remove', onClick: () => onAction('remove'), danger: true },
        ]
      : [{ label: 'Revoke', onClick: () => onAction('revoke'), danger: true }];

  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <MoreActionsMenu items={items} />
    </div>
  );
}
