'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRef, useState } from 'react';
import { graphql, useMutation } from 'react-relay';
import type {
  useCheckConnectionMutation as CheckMutationType,
  useCheckConnectionMutation$data,
} from '@/__generated__/useCheckConnectionMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { accessStateHint, isReadable } from '../../utils/tenant-presentation';

// Selects by id, so every row tag and card reading `access` updates in place — and nothing more. The
// rows consent writes (`domains`, the grant) are a live provider read that `TenantIntegrationSection`
// fetches itself once the state says the tenant is readable; asked for here, they would make the
// probe of a still-unreadable tenant fail on a field the provider cannot answer.
const checkMutation = graphql`
  mutation useCheckConnectionMutation($connectionId: ID!) {
    checkDirectoryConnection(connectionId: $connectionId) {
      connection {
        id
        connectedAt
        access {
          state
          capabilities
        }
      }
      userErrors {
        code
        message
      }
    }
  }
`;

/** The probe's answer, as the mutation returns it. */
export type CheckedAccess = NonNullable<
  useCheckConnectionMutation$data['checkDirectoryConnection']['connection']
>['access'];

/** What the last "Check Connection" said: a verdict from the directory, or no answer at all. */
export type CheckVerdict =
  { readonly kind: 'answered'; readonly access: CheckedAccess } | { readonly kind: 'failed'; readonly message: string };

const CHECK_FAILED = 'Could not check the connection.';

/**
 * "Check Connection" on the New, details and Reconnect pages. The store carries the access state;
 * this keeps only the verdict of the last click, which the card shows beside the button.
 */
export function useCheckConnection(connectionId: string | null) {
  const { toast } = useToast();
  const [commitCheck, isChecking] = useMutation<CheckMutationType>(checkMutation);
  const [verdict, setVerdict] = useState<CheckVerdict | null>(null);
  // Which click the next answer belongs to. `reset` moves it on, so a probe still in flight when the
  // link changed (Edit Domain → Generate) lands nowhere instead of standing under the new link.
  const attemptRef = useRef(0);

  const check = () => {
    if (!connectionId || isChecking) return;
    attemptRef.current += 1;
    const attempt = attemptRef.current;
    const current = () => attempt === attemptRef.current;
    const fail = (message: string) => {
      if (!current()) return;
      setVerdict({ kind: 'failed', message });
      toast({ title: 'Connection check failed', description: message, variant: 'destructive' });
    };
    commitCheck({
      variables: { connectionId },
      onCompleted: ({ checkDirectoryConnection: { connection, userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal || !connection) {
          fail(refusal?.message || CHECK_FAILED);
          return;
        }
        if (!current()) return;
        setVerdict({ kind: 'answered', access: connection.access });
        if (!isReadable(connection.access.state)) {
          toast({
            title: 'Connection check failed',
            description: accessStateHint(connection.access.state),
            variant: 'destructive',
          });
        }
      },
      onError: error => fail(getRelayErrorMessage(error, CHECK_FAILED)),
    });
  };

  /** Forget the last answer, and one still on its way: the link changed (Edit Domain), so neither applies. */
  const reset = () => {
    attemptRef.current += 1;
    setVerdict(null);
  };

  return { check, isChecking, verdict, reset };
}
