'use client';

import { useCallback } from 'react';
import { useMutation, useRelayEnvironment } from 'react-relay';
import type { markNotificationsReadForEntityMutation as MarkForEntityMutationType } from '@/__generated__/markNotificationsReadForEntityMutation.graphql';
import type { NotificationEntityType } from '@/generated/schema-enums';
import { markNotificationsReadForEntityMutation } from './mark-notifications-read-for-entity-mutation';
import { refreshUnreadCounts } from './unread-counts-relay';

/**
 * Marks every notification about one entity (a ticket, a Mingo dialog) read in a single
 * call, and refreshes the per-category counts the sidebar badges read.
 *
 * Complements `EntityViewAutoReader`, which flips the notifications the drawer has actually
 * loaded so its list and connections stay consistent. This one is about the counts: it also
 * clears notifications the drawer never paged in, which is what `Ticket.unreadNotificationCount`
 * and the sidebar bucket are counting. The returned number spans categories, so counts are
 * refetched rather than adjusted locally.
 *
 * Commits no Relay updater, so wherever the auto-reader does NOT also match the current
 * location, a drawer card already in the store keeps showing `read: false` beside a count
 * this call took to zero, until the drawer refetches. The ticket caller avoids that by firing
 * only while the URL carries `tab=chat`, which is exactly what a chat notification's route
 * matches on — a new caller has to arrange the same overlap, or accept the skew rather than
 * reintroduce the by-`meta.ticketId` matching this whole field replaced.
 *
 * `entityId` is the RAW entity id, not a Relay global id, even though the mutation runs
 * against openframe-api: `NotificationReadState.entityId` is written and counted with the
 * id the notification's producer carried (for a ticket, the ai-agent `Ticket.id` that also
 * keys `Ticket.unreadNotificationCount`). Encoding it — as the saas-api time-tracker
 * mutations require via `toTicketGlobalId` — would match zero rows and silently no-op.
 *
 * No toast on failure: the user never triggered this, so a toast would be noise about
 * something they cannot act on, and the next entity open retries. It logs instead, because
 * unlike the decorative `refreshUnreadCounts` this is a write whose failure leaves a wrong
 * badge and a wrong sidebar count with no other trace.
 */
export function useMarkEntityNotificationsRead() {
  const environment = useRelayEnvironment();
  const [commit] = useMutation<MarkForEntityMutationType>(markNotificationsReadForEntityMutation);

  return useCallback(
    (entityType: NotificationEntityType, entityId: string, onCompleted?: () => void) => {
      commit({
        variables: { entityType, entityId },
        onCompleted: () => {
          refreshUnreadCounts(environment);
          onCompleted?.();
        },
        onError: err =>
          console.warn('[Notifications] markNotificationsReadForEntity failed:', entityType, entityId, err),
      });
    },
    [commit, environment],
  );
}
