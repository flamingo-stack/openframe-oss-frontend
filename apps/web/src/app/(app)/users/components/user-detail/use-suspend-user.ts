'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useMutation } from 'react-relay';
import type { useSuspendUserMutation } from '@/__generated__/useSuspendUserMutation.graphql';
import { userErrorsDescription } from '@/lib/form-save';
import { getRelayErrorMessage } from '@/lib/handle-api-error';

// Selects what the user page reads. The accounts have ids, so the header's button and the Details tab's status tag
// update in place; the person's own fields have none and wait for the page's next read (as with Edit User).
const suspendUserMutation = graphql`
  mutation useSuspendUserMutation($input: SetDirectoryUserSuspendedInput!) {
    setDirectoryUserSuspended(input: $input) {
      person {
        ...userDetailHeader_person
        ...userDetailsTab_person
      }
      sessionsStillOpen
      userErrors {
        code
        message
        field
      }
    }
  }
`;

/** The provider took the write; its re-read does not show it yet. */
const SYNC_PENDING = 'SYNC_PENDING';

// Microsoft blocks new sign-ins only; Google ends a suspended user's sessions itself (contract W2-D14).
const SESSIONS_STILL_OPEN = 'Sessions already open stay open until they are revoked.';

export interface SuspendTarget {
  accountId: string;
  /** The customer the write is made for: an account claimed by none cannot be suspended (contract §6). */
  organizationId: string;
  name: string;
}

/**
 * Suspend and Unsuspend: one click each way, reversible, like a connection's Pause. Microsoft calls it blocking
 * sign-in, Google suspending the user; OpenFrame says Suspended for both.
 */
export function useSuspendUser() {
  const { toast } = useToast();
  const [commit, isSaving] = useMutation<useSuspendUserMutation>(suspendUserMutation);

  const setSuspended = ({ accountId, organizationId, name }: SuspendTarget, suspended: boolean) => {
    const failedTitle = suspended ? 'Could not suspend the user' : 'Could not unsuspend the user';
    const doneTitle = suspended ? 'User suspended' : 'User unsuspended';
    const done = suspended ? `${name} can no longer sign in.` : `${name} can sign in again.`;
    const failed = (description: string) => {
      toast({ title: failedTitle, description, variant: 'destructive' });
    };
    commit({
      variables: { input: { id: accountId, organizationId, suspended } },
      onCompleted: ({ setDirectoryUserSuspended: { person, sessionsStillOpen, userErrors } }) => {
        const sessions = suspended && sessionsStillOpen ? ` ${SESSIONS_STILL_OPEN}` : '';
        if (userErrors.length === 0) {
          toast({ title: doneTitle, description: `${done}${sessions}`, variant: 'success' });
          return;
        }
        if (person && userErrors.every(({ code }) => code === SYNC_PENDING)) {
          toast({
            title: doneTitle,
            description: `${userErrorsDescription(userErrors)}${sessions}`,
            variant: 'warning',
          });
          return;
        }
        failed(userErrorsDescription(userErrors));
      },
      onError: error => failed(getRelayErrorMessage(error, 'Please try again.')),
    });
  };

  return { setSuspended, isSaving };
}
