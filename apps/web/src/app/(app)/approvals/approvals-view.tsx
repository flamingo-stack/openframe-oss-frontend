'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { NotificationTile } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ShieldCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { NoData } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useGridInfiniteScroll } from '@/app/(app)/devices/hooks/use-grid-infinite-scroll';
import { type ApprovalCard, composeApprovalInbox } from '@/app/components/approvals/approval-inbox';
import { useApprovalDecider } from '@/app/components/approvals/use-approval-decider';
import { type SourceStatus, useApprovalSources } from '@/app/components/approvals/use-approval-sources';
import { SectionLoadError } from '@/app/components/shared/section-load-error';
import { ApprovalRequestCard } from './approval-request-card';

const TITLE = 'Needs approval';
const SUBTITLE =
  'Actions Mingo prepared and tickets handed to a technician. Nothing runs on a device until someone approves it.';
const LIST_LABEL = 'Approval requests';
const TICKETS_LABEL = 'Tickets waiting for a technician';
const EMPTY_TITLE = 'Nothing needs approval';
const EMPTY_TEXT =
  'When Mingo prepares an action on a device, in a chat or a ticket, it waits here for someone to approve it.';

/**
 * Needs approval (`/approvals`), a page of the Mingo-first shell: the approval requests the
 * user can decide, in two sections — the ones Mingo raised in a chat, then the tickets
 * handed to a technician (Tech Required) that wait on one — loading the next page as it
 * scrolls. Composition and dedupe: `approval-inbox.ts`; the decision and how it reaches
 * the drawer, the chat and the board: `use-approval-decider.ts`.
 */
export function ApprovalsView() {
  const { sources, status } = useApprovalSources();
  const { kept, decide, complete } = useApprovalDecider();
  const inbox = composeApprovalInbox(sources, kept);

  return (
    // `min-h-full`: the page fills the content area, so an empty one has its message in the middle.
    <PageLayout
      title={TITLE}
      subtitle={SUBTITLE}
      className="min-h-full px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
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
 * The approvals. The next page of each source loads as the end of the list scrolls into
 * view. The sources are filtered on the server, but a card is one request, so a page whose
 * requests are already on screen (a chat's and its notification's) adds nothing, and the
 * next one loads on its own until something shows or the sources end.
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
    <div className="flex flex-1 flex-col gap-[var(--spacing-system-sf)]">
      {status.error && <SectionLoadError message={status.error.message} onRetry={status.error.onRetry} />}
      <ApprovalSection
        label={LIST_LABEL}
        cards={cards.filter(card => card.ticketId === null)}
        onDecide={onDecide}
        onComplete={onComplete}
      />
      <ApprovalSection
        label={TICKETS_LABEL}
        cards={cards.filter(card => card.ticketId !== null)}
        onDecide={onDecide}
        onComplete={onComplete}
      />
      {(searching || status.isLoadingMore) && (
        <div className="flex flex-col gap-[var(--spacing-system-sf)]" aria-busy aria-label={`Loading ${LIST_LABEL}`}>
          <NotificationTile loading variant="approval" />
          <NotificationTile loading variant="approval" />
          {cards.length === 0 && <NotificationTile loading variant="approval" />}
        </div>
      )}
      {cards.length === 0 && status.canClaimEmpty && !status.hasMore && (
        <NoData icon={<ShieldCheckIcon />} title={EMPTY_TITLE} description={EMPTY_TEXT} className="flex-1" />
      )}
      {status.hasMore && <div ref={sentinelRef} className="h-px" aria-hidden />}
    </div>
  );
}

interface ApprovalSectionProps {
  label: string;
  cards: ApprovalCard[];
  onDecide: (card: ApprovalCard, approve: boolean) => Promise<void>;
  onComplete: (card: ApprovalCard) => void;
}

/** One kind of request under its name and count; nothing while it has none. */
function ApprovalSection({ label, cards, onDecide, onComplete }: ApprovalSectionProps) {
  if (cards.length === 0) return null;
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xsf)]">
      <h2 className="text-ods-text-secondary text-h5">
        {label} · {cards.length}
      </h2>
      <ul aria-label={label} className="flex flex-col gap-[var(--spacing-system-sf)]">
        {cards.map(card => (
          <li key={card.approvalRequestId}>
            <ApprovalRequestCard card={card} onDecide={onDecide} onComplete={onComplete} />
          </li>
        ))}
      </ul>
    </section>
  );
}
