'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { NotificationTileSkeleton } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ShieldCheckIcon, TagIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { NoData } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useGridInfiniteScroll } from '@/app/(app)/devices/hooks/use-grid-infinite-scroll';
import { type ApprovalCard, composeApprovalInbox } from '@/app/components/approvals/approval-inbox';
import { useApprovalDecider } from '@/app/components/approvals/use-approval-decider';
import { type SourceStatus, useApprovalSources } from '@/app/components/approvals/use-approval-sources';
import { SectionLoadError } from '@/app/components/shared/section-load-error';
import { routes } from '@/lib/routes';
import { ApprovalRequestCard } from './approval-request-card';

const TITLE = 'Needs approval';
const SUBTITLE =
  'Actions Mingo prepared and tickets handed to a technician. Nothing runs on a device until someone approves it.';
const LIST_LABEL = 'Approval requests';
const EMPTY_TITLE = 'Nothing needs approval';
const EMPTY_TEXT =
  'When Mingo prepares an action on a device, in a chat or a ticket, it waits here for someone to approve it.';

/**
 * Needs approval (`/approvals`), a page of the Mingo-first shell: one list of the approval
 * requests the user can decide, whatever raised them — a Mingo chat or a ticket — loading
 * its next page as it scrolls. Composition and dedupe: `approval-inbox.ts`; the decision
 * and how it reaches the drawer, the chat and the board: `use-approval-decider.ts`.
 */
export function ApprovalsView() {
  const { sources, status, techRequiredStatusId } = useApprovalSources();
  const { kept, decide, complete } = useApprovalDecider();
  const inbox = composeApprovalInbox(sources, kept);

  // The tickets waiting on a technician, on the board (SaaS: OSS has no tickets).
  const boardHref = techRequiredStatusId
    ? routes.tickets.filtered({ status: [techRequiredStatusId], viewMode: 'board' })
    : null;

  return (
    <PageLayout
      title={TITLE}
      subtitle={SUBTITLE}
      actions={
        boardHref
          ? [
              {
                label: 'Open board',
                href: boardHref,
                variant: 'outline',
                icon: <TagIcon className="h-5 w-5 text-ods-text-secondary" />,
              },
            ]
          : undefined
      }
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <ApprovalList cards={inbox.cards} status={status} onDecide={decide} onComplete={complete} />
    </PageLayout>
  );
}

interface ApprovalListProps {
  cards: ApprovalCard[];
  status: SourceStatus;
  onDecide: (card: ApprovalCard, approve: boolean) => Promise<void>;
  onComplete: (card: ApprovalCard) => void;
}

/**
 * The approvals. The next page loads as the end of the list scrolls into view; the
 * sources are filtered here (a lane's tickets with a pending approval), so a page may add
 * nothing and the next one loads on its own until something shows or the source ends.
 */
function ApprovalList({ cards, status, onDecide, onComplete }: ApprovalListProps) {
  const sentinelRef = useGridInfiniteScroll({
    enabled: !status.error,
    hasNextPage: status.hasMore,
    isFetchingNextPage: status.isLoadingMore,
    fetchNextPage: status.loadMore,
  });
  const searching = cards.length === 0 && (status.isLoading || status.hasMore);

  if (status.error && cards.length === 0) {
    return <SectionLoadError message={status.error.message} onRetry={status.error.onRetry} />;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-sf)]">
      {status.error && <SectionLoadError message={status.error.message} onRetry={status.error.onRetry} />}
      {cards.length > 0 && (
        <ul aria-label={LIST_LABEL} className="flex flex-col gap-[var(--spacing-system-sf)]">
          {cards.map(card => (
            <li key={card.approvalRequestId}>
              <ApprovalRequestCard card={card} onDecide={onDecide} onComplete={onComplete} />
            </li>
          ))}
        </ul>
      )}
      {(searching || status.isLoadingMore) && (
        <div className="flex flex-col gap-[var(--spacing-system-sf)]" aria-busy aria-label={`Loading ${LIST_LABEL}`}>
          <NotificationTileSkeleton variant="approval" />
          <NotificationTileSkeleton variant="approval" />
          {cards.length === 0 && <NotificationTileSkeleton variant="approval" />}
        </div>
      )}
      {cards.length === 0 && status.canClaimEmpty && !status.hasMore && (
        <NoData icon={<ShieldCheckIcon />} title={EMPTY_TITLE} description={EMPTY_TEXT} />
      )}
      {status.hasMore && <div ref={sentinelRef} className="h-px" aria-hidden />}
    </div>
  );
}
