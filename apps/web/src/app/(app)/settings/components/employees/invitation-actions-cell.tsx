'use client';

import { MoreActionsMenu } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { invitationActionsCell_invitation$key } from '@/__generated__/invitationActionsCell_invitation.graphql';
import { InvitationStatus } from '@/generated/schema-enums';
import { rawIdOf } from '@/lib/relay-id';

const invitationActionsCellFragment = graphql`
  fragment invitationActionsCell_invitation on Invitation {
    id
    email
    status
  }
`;

/** What a confirmation needs: REST takes the raw id, the dialog names the email. */
export interface InvitationTarget {
  id: string;
  email: string;
}

export type InvitationAction = 'revoke' | 'resend' | 'remove';

interface InvitationActionsCellProps {
  invitation: invitationActionsCell_invitation$key;
  onAction: (action: InvitationAction, target: InvitationTarget) => void;
}

/** A pending invitation can be revoked; an expired one resent or removed. */
export function InvitationActionsCell({ invitation, onAction }: InvitationActionsCellProps) {
  const { id, email, status } = useFragment(invitationActionsCellFragment, invitation);
  const target = { id: rawIdOf(id), email };
  const items =
    status === InvitationStatus.EXPIRED
      ? [
          { label: 'Resend', onClick: () => onAction('resend', target) },
          { label: 'Remove', onClick: () => onAction('remove', target), danger: true },
        ]
      : [{ label: 'Revoke', onClick: () => onAction('revoke', target), danger: true }];

  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <MoreActionsMenu items={items} />
    </div>
  );
}
