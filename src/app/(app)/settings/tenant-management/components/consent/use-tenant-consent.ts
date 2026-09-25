'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useRef, useState } from 'react';
import { graphql, useMutation } from 'react-relay';
import type {
  useTenantConsentCheckMutation as CheckMutationType,
  useTenantConsentCheckMutation$data,
} from '@/__generated__/useTenantConsentCheckMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { accessStateHint, isReadable } from '../../utils/tenant-presentation';

// Selects the connection's `access` with its id, so the row tag and the details card update in the store.
const checkMutation = graphql`
  mutation useTenantConsentCheckMutation($connectionId: ID!) {
    checkDirectoryConnection(connectionId: $connectionId) {
      connection {
        id
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

export type ConsentCheckState = 'idle' | 'checking' | 'connected' | 'failed';

/** The probe's answer, as the check mutation returns it. */
export type ConsentCheckResult = NonNullable<
  useTenantConsentCheckMutation$data['checkDirectoryConnection']['connection']
>['access'];

interface ConsentCheck {
  status: ConsentCheckState;
  /** Present for `connected` and for a refused `failed`. */
  result: ConsentCheckResult | null;
  /** A failure with no probe answer (transport or refusal), for `failed` without a result. */
  error: string | null;
}

const IDLE: ConsentCheck = { status: 'idle', result: null, error: null };
const CHECK_FAILED = 'Could not check the connection.';

/**
 * "Check Connection" on the New, details and Reconnect pages. An attempt counter drops an answer
 * that belongs to an earlier click or a reset; a mounted flag drops one that lands after leaving.
 */
export function useTenantConsent(
  connectionId: string | null | undefined,
  { onConnected }: { onConnected?: () => void } = {},
) {
  const { toast } = useToast();
  const [commitCheck] = useMutation<CheckMutationType>(checkMutation);
  const [check, setCheck] = useState<ConsentCheck>(IDLE);
  const attemptRef = useRef(0);
  // Set in the click itself: two clicks in one tick both still see the pre-click `status`.
  const inFlightRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Whether this answer is still the one to show; the current attempt's answer also frees the guard.
  const settle = (attempt: number) => {
    if (attempt !== attemptRef.current) return false;
    inFlightRef.current = false;
    return mountedRef.current;
  };

  const fail = (attempt: number, message: string) => {
    if (!settle(attempt)) return;
    setCheck({ status: 'failed', result: null, error: message });
    toast({ title: 'Connection check failed', description: message, variant: 'destructive' });
  };

  const run = () => {
    // A click while a probe is in flight is dropped; that probe's answer will land.
    if (!connectionId || inFlightRef.current) return;
    inFlightRef.current = true;
    const attempt = ++attemptRef.current;
    setCheck({ status: 'checking', result: null, error: null });
    commitCheck({
      variables: { connectionId },
      onCompleted: ({ checkDirectoryConnection: { connection, userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal || !connection) {
          fail(attempt, refusal?.message || CHECK_FAILED);
          return;
        }
        if (!settle(attempt)) return;
        const result = connection.access;
        if (isReadable(result.state)) {
          setCheck({ status: 'connected', result, error: null });
          onConnected?.();
          return;
        }
        setCheck({ status: 'failed', result, error: null });
        toast({ title: 'Connection check failed', description: accessStateHint(result.state), variant: 'destructive' });
      },
      onError: error => fail(attempt, getRelayErrorMessage(error, CHECK_FAILED)),
    });
  };

  /** Forget the last answer — the link changed (Edit Domain, Reconnect) so it no longer applies. */
  const reset = () => {
    attemptRef.current += 1;
    inFlightRef.current = false;
    setCheck(IDLE);
  };

  return { ...check, isChecking: check.status === 'checking', check: run, reset };
}
