'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Link01BreakIcon, PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  LoadingScope,
  NotFoundError,
  type PageActionButton,
  PageLayout,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { mailboxDetailViewQuery as MailboxDetailViewQueryType } from '@/__generated__/mailboxDetailViewQuery.graphql';
import { noop, useRetryKey } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { MailboxReceivingState } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { DisconnectMailboxDialog } from './disconnect-mailbox-dialog';
import { MailboxStats } from './mailbox-stats';
import { MailboxSummaryCard } from './mailbox-summary-card';

export const MAILBOX_DETAIL_TITLE = 'Mailbox';

// `mailbox` is null for an unknown, foreign or disconnected id (contract part A).
const mailboxDetailViewQuery = graphql`
  query mailboxDetailViewQuery($id: ID!) {
    mailbox(id: $id) {
      id
      supportAddress
      provider
      receivingState
      ...mailboxSummaryCard_mailbox
      ...mailboxStats_mailbox
    }
  }
`;

const ACTION_ICON_CLASS = 'h-5 w-5 text-ods-text-secondary';

function actionsFor(id: string, onDisconnect: () => void): PageActionButton[] {
  return [
    {
      label: 'Disconnect',
      variant: 'outline',
      icon: <Link01BreakIcon className={ACTION_ICON_CLASS} />,
      onClick: onDisconnect,
    },
    {
      label: 'Edit Mailbox',
      variant: 'outline',
      icon: <PenEditIcon className={ACTION_ICON_CLASS} />,
      href: routes.settings.emailToTicket.edit(id),
    },
  ];
}

function DetailFrame({
  title,
  loading,
  actions,
  children,
}: {
  title: string;
  loading?: boolean;
  actions?: PageActionButton[];
  children: ReactNode;
}) {
  const handleBack = useSafeBack(routes.settings.emailToTicket.list);
  return (
    <PageLayout
      title={title}
      loading={loading}
      actions={actions}
      actionsVariant="primary-buttons"
      loadingActions={loading}
      backButton={{ label: 'Back', onClick: handleBack }}
    >
      {children}
    </PageLayout>
  );
}

const BODY_CLASS = 'flex flex-col gap-[var(--spacing-system-l)]';

/**
 * `/settings/email-to-ticket/details?id=` (Figma 4527-132198): the mailbox's card and its 30-day counters, with
 * Disconnect and Edit Mailbox.
 *
 * Not drawn yet, waiting on the backend: Check Forwarding on a NOT RECEIVING mailbox and the Sign In status action
 * (their mutations answer NOT_IMPLEMENTED until CU-17tkuw66n94 / CU-17tkuw66n95), and the Tickets on Hold and Block List
 * tabs (contract part D).
 */
export function MailboxDetailView({ id, loading = false }: { id: string; loading?: boolean }) {
  return (
    <LoadingSuspense live label="Loading mailbox" gated={loading}>
      <MailboxDetailReader id={id} />
    </LoadingSuspense>
  );
}

function MailboxDetailReader({ id }: { id: string }) {
  if (useLoadingScope()) return <MailboxDetailLoading id={id} />;
  return <MailboxDetailQuery id={id} />;
}

/** The page before the record answers: the title as a bar, the actions inert, every card in its loading form. */
function MailboxDetailLoading({ id }: { id: string }) {
  return (
    <DetailFrame title={MAILBOX_DETAIL_TITLE} loading actions={actionsFor(id, noop)}>
      <LoadingScope className={BODY_CLASS}>
        <MailboxSummaryCard mailbox={null} />
        <MailboxStats mailbox={null} />
      </LoadingScope>
    </DetailFrame>
  );
}

function MailboxDetailQuery({ id }: { id: string }) {
  const router = useRouter();
  const retryKey = useRetryKey();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { mailbox } = useLazyLoadQuery<MailboxDetailViewQueryType>(
    mailboxDetailViewQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const pending = mailbox?.receivingState === MailboxReceivingState.PENDING;
  // A Pending mailbox has no details yet: its page is the setup it still owes.
  useEffect(() => {
    if (pending) router.replace(routes.settings.emailToTicket.new({ id }));
  }, [pending, id, router]);

  // Disconnected: the record is gone from the store before the redirect to the list lands.
  if (!mailbox && leaving) return <MailboxDetailLoading id={id} />;
  if (!mailbox) {
    return (
      <DetailFrame title={MAILBOX_DETAIL_TITLE}>
        <NotFoundError message="Mailbox not found" onHome={() => router.replace(routes.settings.emailToTicket.list)} />
      </DetailFrame>
    );
  }
  // On its way to the setup page: the page as it loads, not a blank one.
  if (pending) return <MailboxDetailLoading id={id} />;

  return (
    <DetailFrame title={mailbox.supportAddress} actions={actionsFor(mailbox.id, () => setDisconnectOpen(true))}>
      <div className={BODY_CLASS}>
        <MailboxSummaryCard mailbox={mailbox} />
        <MailboxStats mailbox={mailbox} />
      </div>
      <DisconnectMailboxDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        mailboxId={mailbox.id}
        supportAddress={mailbox.supportAddress}
        provider={mailbox.provider}
        onLeavingChange={setLeaving}
      />
    </DetailFrame>
  );
}
