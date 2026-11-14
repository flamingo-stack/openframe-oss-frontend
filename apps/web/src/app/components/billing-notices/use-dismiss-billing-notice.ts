'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useMutation } from 'react-relay';
import type { RecordSourceSelectorProxy } from 'relay-runtime';
import type { useDismissBillingNoticeMutation as UseDismissBillingNoticeMutationType } from '@/__generated__/useDismissBillingNoticeMutation.graphql';
import type { BillingNoticeType } from '@/generated/schema-enums';
import { getRelayErrorMessage } from '@/lib/handle-api-error';

const useDismissBillingNoticeMutation = graphql`
  mutation useDismissBillingNoticeMutation($type: BillingNoticeType!, $eventKey: String!) {
    dismissBillingNotice(type: $type, eventKey: $eventKey)
  }
`;

/** The root field `useBillingNoticesQuery` reads the list from. */
const NOTICES_FIELD = 'billingNotices';

/**
 * Dismisses a notice for the whole workspace until its next event. The API
 * refuses PAYMENT_OVERDUE and ACCOUNT_SUSPENDED, so only the trial and auto
 * top-up bars call it.
 *
 * The notice leaves the store at once and stays gone (the answer is a bare
 * Boolean, so the optimistic removal is replayed as the real one); a refusal
 * rolls it back and says so.
 */
export function useDismissBillingNotice() {
  const { toast } = useToast();
  const [commit] = useMutation<UseDismissBillingNoticeMutationType>(useDismissBillingNoticeMutation);

  return (type: BillingNoticeType, eventKey: string) => {
    const removeNotice = (store: RecordSourceSelectorProxy) => {
      const root = store.getRoot();
      const notices = root.getLinkedRecords(NOTICES_FIELD);
      if (!notices) return;
      root.setLinkedRecords(
        notices.filter(notice => !(notice.getValue('type') === type && notice.getValue('eventKey') === eventKey)),
        NOTICES_FIELD,
      );
    };
    commit({
      variables: { type, eventKey },
      optimisticUpdater: removeNotice,
      updater: removeNotice,
      onError: error => {
        toast({
          title: 'Could not dismiss the notice',
          description: getRelayErrorMessage(error, 'Try again in a moment.'),
          variant: 'destructive',
        });
      },
    });
  };
}
