'use client';

import { DashboardInfoCard } from '@flamingo-stack/openframe-frontend-core';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { mailboxStats_mailbox$key } from '@/__generated__/mailboxStats_mailbox.graphql';

const mailboxStatsFragment = graphql`
  fragment mailboxStats_mailbox on Mailbox {
    stats {
      received
      ticketsCreated
      held
      dropped
    }
  }
`;

/** The four counters of the last 30 days (Figma 4527-132198; contract part A, `MailboxStats`). */
const CARDS = [
  { key: 'received', title: 'Emails received' },
  { key: 'ticketsCreated', title: 'Tickets' },
  { key: 'held', title: 'Held for review' },
  { key: 'dropped', title: 'Dropped' },
] as const;

/** The stat cards; in a loading scope (no record yet) each card draws its own loading state. */
export function MailboxStats({ mailbox }: { mailbox: mailboxStats_mailbox$key | null }) {
  const scoped = useLoadingScope();
  const fragment = useFragment(mailboxStatsFragment, mailbox);
  const stats = scoped ? null : (fragment?.stats ?? null);
  return (
    <div className="grid grid-cols-2 gap-[var(--spacing-system-m)] content-lg:grid-cols-4">
      {CARDS.map(card => (
        <DashboardInfoCard
          key={card.key}
          title={card.title}
          value={stats ? stats[card.key] : ''}
          loading={stats == null}
        />
      ))}
    </div>
  );
}
