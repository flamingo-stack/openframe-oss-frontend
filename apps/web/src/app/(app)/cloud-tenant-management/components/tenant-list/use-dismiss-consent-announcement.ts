'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useMutation } from 'react-relay';
import type { useDismissConsentAnnouncementMutation as DismissMutationType } from '@/__generated__/useDismissConsentAnnouncementMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';

// Answers only `true`: the updater drops the banner from the store, and the caller re-reads the query.
const dismissMutation = graphql`
  mutation useDismissConsentAnnouncementMutation {
    dismissDirectoryConsentAnnouncement
  }
`;

/** "Dismiss" on the re-consent banner. Hides it for the whole workspace, not just this user. */
export function useDismissConsentAnnouncement(onDismissed: () => void) {
  const { toast } = useToast();
  const [commitDismiss, isDismissing] = useMutation<DismissMutationType>(dismissMutation);

  const dismiss = () => {
    if (isDismissing) return;
    commitDismiss({
      variables: {},
      updater: store => store.getRoot().setValue(null, 'directoryConsentAnnouncement'),
      onCompleted: () => {
        onDismissed();
        toast({
          title: 'Announcement dismissed',
          description: 'It is hidden for everyone in this workspace.',
          variant: 'success',
        });
      },
      onError: error => {
        toast({
          title: 'Could not dismiss the announcement',
          description: getRelayErrorMessage(error, 'Try again in a moment.'),
          variant: 'destructive',
        });
      },
    });
  };

  return { dismiss, isDismissing };
}
