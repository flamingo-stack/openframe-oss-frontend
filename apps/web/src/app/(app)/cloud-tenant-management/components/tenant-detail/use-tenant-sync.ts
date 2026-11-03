'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useMutation } from 'react-relay';
import type { useTenantSyncPauseMutation } from '@/__generated__/useTenantSyncPauseMutation.graphql';
import type { useTenantSyncResumeMutation } from '@/__generated__/useTenantSyncResumeMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { userErrorsDescription } from '../tenant-form/attribution-helpers';

// By id, so the title's actions, the notice, the card's status and a list row already read update in place.
const pauseMutation = graphql`
  mutation useTenantSyncPauseMutation($connectionId: ID!) {
    pauseDirectoryConnection(connectionId: $connectionId) {
      connection {
        id
        enabled
        ...tenantSyncPausedNotice_connection
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`;

const resumeMutation = graphql`
  mutation useTenantSyncResumeMutation($connectionId: ID!) {
    resumeDirectoryConnection(connectionId: $connectionId) {
      connection {
        id
        enabled
        ...tenantSyncPausedNotice_connection
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`;

/** Pause Sync and Resume Sync (Figma 3469-49200, 3226-2439): one click each way, nothing is lost by either. */
export function useTenantSync(connectionId: string | null) {
  const { toast } = useToast();
  const [commitPause, isPausing] = useMutation<useTenantSyncPauseMutation>(pauseMutation);
  const [commitResume, isResuming] = useMutation<useTenantSyncResumeMutation>(resumeMutation);

  const failed = (title: string, description: string) => {
    toast({ title, description, variant: 'destructive' });
  };

  const pause = () => {
    if (!connectionId) return;
    commitPause({
      variables: { connectionId },
      onCompleted: ({ pauseDirectoryConnection: { userErrors } }) => {
        if (userErrors.length > 0) {
          failed('Could not pause the sync', userErrorsDescription(userErrors));
          return;
        }
        toast({ title: 'Sync paused', description: 'OpenFrame stopped reading this directory.', variant: 'success' });
      },
      onError: error => failed('Could not pause the sync', getRelayErrorMessage(error, 'Please try again.')),
    });
  };

  const resume = () => {
    if (!connectionId) return;
    commitResume({
      variables: { connectionId },
      onCompleted: ({ resumeDirectoryConnection: { userErrors } }) => {
        if (userErrors.length > 0) {
          failed('Could not resume the sync', userErrorsDescription(userErrors));
          return;
        }
        toast({ title: 'Sync resumed', description: 'OpenFrame is reading this directory again.', variant: 'success' });
      },
      onError: error => failed('Could not resume the sync', getRelayErrorMessage(error, 'Please try again.')),
    });
  };

  return { pause, resume, isBusy: isPausing || isResuming };
}
