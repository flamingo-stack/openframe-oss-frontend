'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { NotificationTileSkeleton } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ShieldCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, NoData } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useId } from 'react';
import { type ApprovalCard, composeApprovalInbox } from '@/app/components/approvals/approval-inbox';
import { useApprovalDecider } from '@/app/components/approvals/use-approval-decider';
import { type SourceStatus, useApprovalSources } from '@/app/components/approvals/use-approval-sources';
import { SectionLoadError } from '@/app/components/shared/section-load-error';
import { routes } from '@/lib/routes';
import { ApprovalRequestCard } from './approval-request-card';

const SUBTITLE =
  'Actions Mingo prepared and tickets handed to a technician. Nothing runs on a device until someone approves it.';

/**
 * Needs approval (`/approvals`), a page of the Mingo-first shell: every approval request
 * the user can decide, then the Tech Required tickets waiting on a technician's approval
 * (SaaS only — OSS has no tickets). Composition and dedupe: `approval-inbox.ts`; the
 * decision and how it reaches the drawer, the chat and the board: `use-approval-decider.ts`.
 */
export function ApprovalsView() {
  const { sources, requests, tickets, ticketsEnabled, techRequiredStatusId } = useApprovalSources();
  const { kept, decide, complete } = useApprovalDecider();
  const inbox = composeApprovalInbox(sources, kept);

  const nothingWaiting =
    inbox.requests.length === 0 &&
    inbox.tickets.length === 0 &&
    requests.canClaimEmpty &&
    (!ticketsEnabled || tickets.canClaimEmpty);

  const renderCard = (card: ApprovalCard) => (
    <ApprovalRequestCard card={card} onDecide={decide} onComplete={complete} />
  );

  return (
    <PageLayout
      title="Needs approval"
      subtitle={SUBTITLE}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {nothingWaiting ? (
        <NoData
          icon={<ShieldCheckIcon />}
          title="Nothing needs approval"
          description="When Mingo prepares an action or a ticket waits for a technician, it shows up here."
        />
      ) : (
        <div className="flex flex-col gap-[var(--spacing-system-xl)]">
          <ApprovalSection
            title="Approval requests"
            cards={inbox.requests}
            status={requests}
            aside={<span className="shrink-0 text-ods-text-secondary text-h6">{inbox.pendingRequests} pending</span>}
            emptyText="No approval requests are waiting."
            renderCard={renderCard}
          />
          {ticketsEnabled && (
            <ApprovalSection
              title="Tickets waiting for a technician"
              cards={inbox.tickets}
              status={tickets}
              aside={
                techRequiredStatusId ? (
                  <Button
                    variant="link"
                    size="compact"
                    noPaddingX
                    href={routes.tickets.filtered({ status: [techRequiredStatusId], viewMode: 'board' })}
                  >
                    Tech Required on the board
                  </Button>
                ) : null
              }
              emptyText="No tickets are waiting for a technician's approval."
              renderCard={renderCard}
            />
          )}
        </div>
      )}
    </PageLayout>
  );
}

interface ApprovalSectionProps {
  title: string;
  cards: ApprovalCard[];
  status: SourceStatus;
  aside: ReactNode;
  emptyText: string;
  renderCard: (card: ApprovalCard) => ReactNode;
}

function ApprovalSection({ title, cards, status, aside, emptyText, renderCard }: ApprovalSectionProps) {
  const headingId = useId();
  const loadingEmpty = status.isLoading && cards.length === 0;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-[var(--spacing-system-s)]">
      <div className="flex min-h-6 items-center justify-between gap-[var(--spacing-system-s)]">
        <h2 id={headingId} className="min-w-0 truncate text-ods-text-secondary text-h5">
          {loadingEmpty ? title : `${title} · ${cards.length}`}
        </h2>
        {aside}
      </div>

      {status.error && <SectionLoadError message={status.error.message} onRetry={status.error.onRetry} />}

      {loadingEmpty ? (
        <div className="flex flex-col gap-[var(--spacing-system-sf)]" aria-busy>
          <NotificationTileSkeleton variant="approval" />
          <NotificationTileSkeleton variant="approval" />
        </div>
      ) : cards.length > 0 ? (
        <ul className="flex flex-col gap-[var(--spacing-system-sf)]">
          {cards.map(card => (
            <li key={card.approvalRequestId}>{renderCard(card)}</li>
          ))}
        </ul>
      ) : status.canClaimEmpty ? (
        <p className="text-ods-text-secondary text-h6">{emptyText}</p>
      ) : null}

      {status.hasMore && (
        <Button variant="outline" className="self-start" loading={status.isLoadingMore} onClick={status.loadMore}>
          Show more
        </Button>
      )}
    </section>
  );
}
