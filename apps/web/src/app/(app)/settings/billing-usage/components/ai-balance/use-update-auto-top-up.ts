'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useMutation } from 'react-relay';
import type {
  AutoTopUpSettingsInput,
  useUpdateAutoTopUpMutation as UseUpdateAutoTopUpMutationType,
} from '@/__generated__/useUpdateAutoTopUpMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { type AutoTopUpStatus, toAutoTopUpStatus } from './auto-top-up-status';

export type { AutoTopUpSettingsInput };

/**
 * Sets the standing arrangement. Enabling requires a threshold, and the amount
 * must exceed it; both are validated on the backend beside the rules a manual
 * purchase obeys, so what comes back is the arrangement as it now stands — or,
 * when there is no card to charge, where to add one (see `AutoTopUpStatus`).
 */
const updateAutoTopUpMutation = graphql`
  mutation useUpdateAutoTopUpMutation($input: AutoTopUpSettingsInput!) {
    updateAutoTopUp(input: $input) {
      ...autoTopUpStatus_settings
    }
  }
`;

interface UpdateAutoTopUpOptions {
  /** The backend answered. The caller reads the answer — enabling can be refused for want of a card. */
  onCompleted?: (status: AutoTopUpStatus) => void;
}

export function useUpdateAutoTopUp() {
  const { toast } = useToast();
  const [commit, isInFlight] = useMutation<UseUpdateAutoTopUpMutationType>(updateAutoTopUpMutation);

  const mutate = (input: AutoTopUpSettingsInput, options?: UpdateAutoTopUpOptions) => {
    commit({
      variables: { input },
      // `AutoTopUpSettings` has no id, so the payload lands beside the root field
      // the page reads (`autoTopUpSettings`) rather than on it. Relinking the root
      // is what updates the card's mark and the modal in place.
      updater: store => {
        const payload = store.getRootField('updateAutoTopUp');
        if (payload) store.getRoot().setLinkedRecord(payload, 'autoTopUpSettings');
      },
      onCompleted: response => options?.onCompleted?.(toAutoTopUpStatus(response.updateAutoTopUp)),
      onError: err => {
        toast({
          title: 'Auto Top-up Not Saved',
          description: getRelayErrorMessage(err, 'Failed to save the auto top-up settings'),
          variant: 'destructive',
        });
      },
    });
  };

  return { mutate, isPending: isInFlight };
}
