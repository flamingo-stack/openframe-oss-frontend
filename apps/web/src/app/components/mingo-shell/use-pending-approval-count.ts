'use client';

import { composeApprovalInbox } from '@/app/components/approvals/approval-inbox';
import { useApprovalSources } from '@/app/components/approvals/use-approval-sources';

/**
 * The sidebar's "Needs approval" badge: how many approval requests wait for a decision —
 * exactly the pending cards the Needs approval page shows, from the same sources (the
 * drawer's approval notifications, the Mingo chats waiting on one, the Tech Required lane
 * on SaaS), deduped the same way. A decision on any surface takes its request off at once.
 *
 * The sources are shared caches, not requests of this hook's own: the page, this badge
 * and (for the lane) the tickets board read the same query entries.
 */
export function usePendingApprovalCount(): number {
  const { sources } = useApprovalSources();
  return composeApprovalInbox(sources).pendingCount;
}
