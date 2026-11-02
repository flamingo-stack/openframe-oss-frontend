'use client';

import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
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
  // A row still being read (a loading scope) has no fragment to read: the trigger is drawn for real and inert (the
  // menu's own loading form), with nothing in it.
  const data = useFragment(invitationActionsCellFragment, useLoadingScope() ? null : invitation);
  const groups: ActionsMenuGroup[] = !data
    ? []
    : [
        {
          items:
            data.status === InvitationStatus.EXPIRED
              ? [
                  { id: 'resend', label: 'Resend', onClick: () => onAction('resend') },
                  { id: 'remove', label: 'Remove', onClick: () => onAction('remove'), danger: true },
                ]
              : [{ id: 'revoke', label: 'Revoke', onClick: () => onAction('revoke'), danger: true }],
        },
      ];

  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <ActionsMenuDropdown groups={groups} />
    </div>
  );
}
