'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  Link01BreakIcon,
  PenEditIcon,
  Refresh01LeftIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  LoadingScope,
  NotFoundError,
  type PageActionButton,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { graphql, useFragment, useLazyLoadQuery } from 'react-relay';
import type { mailboxDetailView_forwarding$key } from '@/__generated__/mailboxDetailView_forwarding.graphql';
import type { mailboxDetailViewQuery as MailboxDetailViewQueryType } from '@/__generated__/mailboxDetailViewQuery.graphql';
import { noop, useRetryKey } from '@/app/components/shared';
import { MailboxAction, MailboxReceivingState } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { MailboxBlockList } from '../block-list/mailbox-block-list';
import { useForwardingTest } from '../forwarding/use-forwarding-test';
import { MailboxPageFrame } from '../shared/mailbox-page-frame';
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
      receivingState
      ...mailboxDetailView_forwarding
      ...mailboxSummaryCard_mailbox
      ...mailboxStats_mailbox
      ...disconnectMailboxDialog_mailbox
    }
  }
`;

// What Check Forwarding reads: whether it is offered, and a run waiting for its email (the forwarding test's poll keeps
// it current).
const mailboxDetailViewForwardingFragment = graphql`
  fragment mailboxDetailView_forwarding on Mailbox {
    actions
    lastTest {
      state
      deadlineAt
    }
  }
`;

const ACTION_ICON_CLASS = 'h-5 w-5 text-ods-text-secondary';

interface CheckForwardingAction {
  onClick: () => void;
  /** A run is starting or waiting for its email: the button spins until the run is decided. */
  running: boolean;
}

function actionsFor(id: string, onDisconnect: () => void, checkForwarding?: CheckForwardingAction): PageActionButton[] {
  const actions: PageActionButton[] = [
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
  if (checkForwarding) {
    actions.push({
      label: 'Check Forwarding',
      variant: 'outline',
      icon: <Refresh01LeftIcon className={ACTION_ICON_CLASS} />,
      onClick: checkForwarding.onClick,
      loading: checkForwarding.running,
      disabled: checkForwarding.running,
    });
  }
  return actions;
}

/**
 * `/settings/email-to-ticket/details?id=` (Figma 4527-132198): the mailbox's card and its 30-day counters, with
 * Disconnect and Edit Mailbox, and Check Forwarding on a NOT RECEIVING mailbox (Figma 4631-6900): the test's result
 * moves the receiving state in the card.
 *
 * Not drawn yet, waiting on the backend: the Sign In status action (`startSendAsSignIn` answers NOT_IMPLEMENTED until
 * CU-17tkuw66n95) and the Tickets on Hold tab (contract part D, held emails).
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
    <MailboxPageFrame title={MAILBOX_DETAIL_TITLE} loading actions={actionsFor(id, noop)}>
      <LoadingScope className="flex flex-col gap-[var(--spacing-system-l)]">
        <MailboxSummaryCard mailbox={null} />
        <MailboxStats mailbox={null} />
        <MailboxBlockList mailboxId={id} />
      </LoadingScope>
    </MailboxPageFrame>
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
  const forwarding = useFragment<mailboxDetailView_forwarding$key>(mailboxDetailViewForwardingFragment, mailbox);
  const forwardingTest = useForwardingTest({
    mailboxId: id,
    pollQuery: mailboxDetailViewQuery,
    state: forwarding?.lastTest.state,
    deadlineAt: forwarding?.lastTest.deadlineAt,
  });
  const pending = mailbox?.receivingState === MailboxReceivingState.PENDING;
  // A Pending mailbox has no details yet: its page is the setup it still owes.
  useEffect(() => {
    if (pending) router.replace(routes.settings.emailToTicket.new({ id }));
  }, [pending, id, router]);

  // On its way out: to the setup page (Pending), or to the list once a disconnect has removed the record.
  if (pending || (!mailbox && leaving)) return <MailboxDetailLoading id={id} />;
  if (!mailbox) {
    return (
      <MailboxPageFrame title={MAILBOX_DETAIL_TITLE}>
        <NotFoundError message="Mailbox not found" onHome={() => router.replace(routes.settings.emailToTicket.list)} />
      </MailboxPageFrame>
    );
  }
  // Offered while the mailbox is not receiving (contract part A, `MailboxAction`), and kept, spinning, while its run waits.
  const running = forwardingTest.isStarting || forwardingTest.waiting;
  const checkForwarding =
    forwarding?.actions.includes(MailboxAction.CHECK_FORWARDING) || running
      ? { onClick: forwardingTest.run, running }
      : undefined;
  return (
    <MailboxPageFrame
      title={mailbox.supportAddress}
      actions={actionsFor(mailbox.id, () => setDisconnectOpen(true), checkForwarding)}
    >
      <MailboxSummaryCard mailbox={mailbox} />
      <MailboxStats mailbox={mailbox} />
      <MailboxBlockList mailboxId={mailbox.id} />
      <DisconnectMailboxDialog
        mailbox={mailbox}
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        onLeavingChange={setLeaving}
      />
    </MailboxPageFrame>
  );
}
