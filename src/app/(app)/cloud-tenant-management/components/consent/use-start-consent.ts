'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { graphql, useMutation } from 'react-relay';
import type { useStartConsentMutation as StartConsentMutationType } from '@/__generated__/useStartConsentMutation.graphql';
import { useSubscriptionOpen } from '@/app/components/subscription-lock/subscription-guard';
import { getRelayErrorMessage } from '@/lib/handle-api-error';

// Selects the link by id: the consent card reading `consentUrl` swaps to the new one in place.
const startConsentMutation = graphql`
  mutation useStartConsentMutation($connectionId: ID!) {
    startDirectoryConsent(connectionId: $connectionId) {
      connection {
        id
        consentUrl
      }
      userErrors {
        code
        message
      }
    }
  }
`;

export const MINT_FAILED = 'Could not create a consent link';

interface StartConsentOptions {
  /**
   * Mint once on mount while true — for a page that IS the request for a link. Gated on the
   * subscription like every effect-fired request; a ref keeps StrictMode's second effect run out.
   */
  autoMintWhen?: boolean;
}

/** Mints a consent link — a fresh one replaces any outstanding one, so nothing here mints twice. */
export function useStartConsent(connectionId: string | null, { autoMintWhen = false }: StartConsentOptions = {}) {
  const { toast } = useToast();
  const [commitStartConsent, isMinting] = useMutation<StartConsentMutationType>(startConsentMutation);
  const [mintFailed, setMintFailed] = useState(false);
  const subscriptionOpen = useSubscriptionOpen();
  const startedRef = useRef(false);

  // Stable: the mount effect depends on it.
  const mint = useCallback(
    (onMinted?: () => void) => {
      if (!connectionId) return;
      const fail = (message: string) => {
        setMintFailed(true);
        toast({ title: MINT_FAILED, description: message, variant: 'destructive' });
      };
      commitStartConsent({
        variables: { connectionId },
        onCompleted: ({ startDirectoryConsent: { connection, userErrors } }) => {
          const [refusal] = userErrors;
          if (refusal || !connection?.consentUrl) {
            fail(refusal?.message || 'Try again in a moment.');
            return;
          }
          setMintFailed(false);
          onMinted?.();
        },
        onError: error => fail(getRelayErrorMessage(error, 'Try again in a moment.')),
      });
    },
    [commitStartConsent, connectionId, toast],
  );

  useEffect(() => {
    if (!autoMintWhen || !subscriptionOpen || startedRef.current) return;
    startedRef.current = true;
    mint();
  }, [autoMintWhen, subscriptionOpen, mint]);

  return { mint, isMinting, mintFailed };
}
