'use client';

import { useEffect, useMemo } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { unreadCountsRelayQuery as UnreadCountsRelayQueryType } from '@/__generated__/unreadCountsRelayQuery.graphql';
import { NotificationCategory } from '@/generated/schema-enums';
import { unreadCountsRelayQuery } from '@/graphql/notifications/unread-counts-relay';

export type UnreadCountsByCategory = Partial<Record<NotificationCategory, number>>;

/** The categories this build knows about, from the generated schema enum. */
const KNOWN_CATEGORIES = new Set<NotificationCategory>(Object.values(NotificationCategory));

interface UnreadCountsHydratorProps {
  onChange: (counts: UnreadCountsByCategory) => void;
}

/**
 * Loads per-category unread notification counts into the Relay store and lifts
 * them to the app shell. Subscribed to the store, so `refreshUnreadCounts`
 * calls (NATS pushes, mark-read mutations) propagate here automatically.
 */
export function UnreadCountsHydrator({ onChange }: UnreadCountsHydratorProps) {
  const data = useLazyLoadQuery<UnreadCountsRelayQueryType>(
    unreadCountsRelayQuery,
    {},
    { fetchPolicy: 'store-and-network' },
  );

  const counts = useMemo(() => {
    const next: UnreadCountsByCategory = {};
    for (const entry of data.unreadCountsByCategory) {
      if (entry.count <= 0) continue;
      // Membership test rather than a comparison against Relay's
      // `'%future added value'` sentinel: the sentinel exists so a server that
      // grows a category does not break this client, and asking "is this one of
      // the categories this build knows" is the question that stays correct when
      // it does. A category we cannot name has no counter to increment.
      if (!KNOWN_CATEGORIES.has(entry.category as NotificationCategory)) continue;
      next[entry.category as NotificationCategory] = entry.count;
    }
    return next;
  }, [data.unreadCountsByCategory]);

  useEffect(() => {
    onChange(counts);
  }, [counts, onChange]);

  return null;
}
