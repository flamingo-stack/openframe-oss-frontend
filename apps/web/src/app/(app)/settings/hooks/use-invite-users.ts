'use client';

import { graphql, useMutation } from 'react-relay';
import type { useInviteUsersMutation } from '@/__generated__/useInviteUsersMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';

const inviteUsersMutation = graphql`
  mutation useInviteUsersMutation($emails: [String!]!) {
    inviteUsers(input: { emails: $emails }) {
      userErrors {
        field
        message
      }
    }
  }
`;

/** The email a userError points at: its field is ["emails", "<index>"]. */
function emailOf(emails: string[], field: readonly string[] | null | undefined): string | undefined {
  const index = Number(field?.[1]);
  return Number.isInteger(index) ? emails[index] : undefined;
}

/**
 * One invitation per email. Resolves when all were sent; rejects with every refused
 * address otherwise, the rest having been sent anyway. The caller toasts: it knows
 * how many it asked for.
 */
export function useInviteUsers() {
  const [commit, isInFlight] = useMutation<useInviteUsersMutation>(inviteUsersMutation);

  const inviteUsers = (emails: string[]) =>
    new Promise<void>((resolve, reject) => {
      const trimmed = emails.map(e => e.trim()).filter(e => e.length > 0);
      if (trimmed.length === 0) {
        resolve();
        return;
      }
      commit({
        variables: { emails: trimmed },
        onCompleted: (response, errors) => {
          if (errors?.length) {
            reject(new Error(errors[0].message));
            return;
          }
          const refused = response.inviteUsers.userErrors.map(e => {
            const email = emailOf(trimmed, e.field);
            return email ? `${email}: ${e.message}` : e.message;
          });
          if (refused.length) reject(new Error(`Failed to invite ${refused.join('; ')}`));
          else resolve();
        },
        onError: error => reject(new Error(getRelayErrorMessage(error, 'Failed to send invites'))),
      });
    });

  return { inviteUsers, isInFlight };
}
