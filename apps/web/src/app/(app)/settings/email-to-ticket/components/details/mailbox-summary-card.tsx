'use client';

import { LoadingWhen, SquareAvatar, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { graphql, useFragment } from 'react-relay';
import type {
  mailboxSummaryCard_mailbox$data,
  mailboxSummaryCard_mailbox$key,
} from '@/__generated__/mailboxSummaryCard_mailbox.graphql';
import { InfoCell } from '@/app/components/shared/info-cell';
import { MailboxReplyState } from '@/generated/schema-enums';
import { toUserSummary } from '@/graphql/users/user-summary-fields';
import { getFullImageUrl } from '@/lib/image-url';
import {
  mailboxProviderPresentation,
  receivingStateDetailLine,
  receivingStateTag,
  replyStateLine,
} from '../../utils/mailbox-presentation';

// The three-row card of the details page (Figma 4527-132198): where it forwards and how it receives, how replies
// leave, and the routing defaults.
const CARD_CLASSES = 'flex flex-col rounded-md border border-ods-border bg-ods-card';
const ROW_CLASSES =
  'grid grid-cols-1 gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] content-md:grid-cols-2 content-md:min-h-20 content-md:items-center';
const DEFAULTS_ROW_CLASSES =
  'grid grid-cols-1 gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] content-md:grid-cols-3 content-md:min-h-20 content-md:items-center';
const DIVIDED = 'border-t border-ods-border';

const LABELS = {
  forwardsTo: 'Forwards to',
  replyAs: 'Reply as',
  signedIn: 'Signed in',
  defaultCustomer: 'Default Customer',
  defaultStatus: 'Default Status',
  defaultAssignee: 'Default Assignee',
} as const;

/** What the server reads a missing default status as (contract part A, `updateMailbox`). */
const TECH_REQUIRED_LABEL = 'Tech Required';

const mailboxSummaryCardFragment = graphql`
  fragment mailboxSummaryCard_mailbox on Mailbox {
    supportAddress
    provider
    inboundAddress
    receivingState
    replyState
    lastFinishedTestAt
    signedInAccount
    defaultOrganization {
      name
      image {
        imageUrl
        hash
      }
    }
    defaultStatus {
      name
    }
    defaultAssignee {
      ...userSummaryFields_user
    }
  }
`;

type SummaryData = mailboxSummaryCard_mailbox$data;

const PROVIDER_LOGO_PX = 24;

/** The receiving state's tag and its line, both drawn in the cell's loading scope. */
function ReceivingCell({ data }: { data: SummaryData | null }) {
  const tag = data ? receivingStateTag(data.receivingState) : null;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-[var(--spacing-system-xxs)]">
      <Tag {...(tag ? { label: tag.label, variant: tag.variant } : { label: null })} />
      <InfoCellLine text={data ? receivingStateDetailLine(data) : null} />
    </div>
  );
}

/** A secondary line, a bar while the record is read. */
function InfoCellLine({ text }: { text: string | null }) {
  const loading = useLoadingScope() || text == null;
  return (
    <LoadingWhen loading={loading}>
      <p className={cn('truncate text-ods-text-secondary text-h6', loading && 'w-40')}>{text}</p>
    </LoadingWhen>
  );
}

/**
 * Reply as: the mailbox itself while replies leave as it; otherwise why replies by email are off (contract part A,
 * S2, D45). The sign-in that turns them on is not drawn yet: `startSendAsSignIn` answers NOT_IMPLEMENTED until
 * CU-17tkuw66n95.
 */
function ReplyAsCell({ data }: { data: SummaryData | null }) {
  const provider = data ? mailboxProviderPresentation(data.provider) : null;
  const sending = data?.replyState === MailboxReplyState.AS_MAILBOX;
  return (
    <InfoCell
      label={LABELS.replyAs}
      skeletonWidth="w-48"
      icon={provider && sending && <provider.Logo size={PROVIDER_LOGO_PX} role="img" aria-label={provider.label} />}
      iconSkeleton={{ size: 'md' }}
      value={
        data ? (
          sending ? (
            data.supportAddress
          ) : (
            <span className="text-ods-text-secondary">{replyStateLine(data.replyState)}</span>
          )
        ) : null
      }
    />
  );
}

function CustomerCell({ data }: { data: SummaryData | null }) {
  const customer = data?.defaultOrganization ?? null;
  return (
    <InfoCell
      label={LABELS.defaultCustomer}
      skeletonWidth="w-36"
      icon={
        (data == null || customer) && (
          <SquareAvatar
            src={customer ? getFullImageUrl(customer.image?.imageUrl, customer.image?.hash) : undefined}
            alt={customer?.name}
            fallback={customer?.name ?? ''}
            size="xs"
            variant="square"
          />
        )
      }
      // No Default Customer: unknown senders are held for review (contract part A, D19).
      value={data ? (customer?.name ?? 'None · unknown senders are held') : null}
    />
  );
}

function AssigneeCell({ data }: { data: SummaryData | null }) {
  const assignee = data?.defaultAssignee ? toUserSummary(data.defaultAssignee) : null;
  return (
    <InfoCell
      label={LABELS.defaultAssignee}
      skeletonWidth="w-36"
      icon={
        (data == null || assignee) && (
          <SquareAvatar
            src={assignee?.avatarUrl}
            alt={assignee?.name}
            fallback={assignee?.name ?? ''}
            size="xs"
            variant="round"
          />
        )
      }
      value={data ? (assignee?.name ?? 'Unassigned') : null}
    />
  );
}

/**
 * The details page's card. Before the record answers (a loading scope) every cell draws its own loading state with its
 * label real, so the page does not jump when the record lands.
 */
export function MailboxSummaryCard({ mailbox }: { mailbox: mailboxSummaryCard_mailbox$key | null }) {
  const scoped = useLoadingScope();
  const fragment = useFragment(mailboxSummaryCardFragment, mailbox);
  const data = scoped ? null : fragment;
  return (
    <LoadingWhen loading={data == null}>
      <div className={CARD_CLASSES}>
        <div className={ROW_CLASSES}>
          <InfoCell label={LABELS.forwardsTo} value={data?.inboundAddress} skeletonWidth="w-56" />
          <ReceivingCell data={data ?? null} />
        </div>
        <div className={cn(ROW_CLASSES, DIVIDED)}>
          <ReplyAsCell data={data ?? null} />
          <InfoCell label={LABELS.signedIn} value={data?.signedInAccount} skeletonWidth="w-48" />
        </div>
        <div className={cn(DEFAULTS_ROW_CLASSES, DIVIDED)}>
          <CustomerCell data={data ?? null} />
          <InfoCell
            label={LABELS.defaultStatus}
            value={data ? (data.defaultStatus?.name ?? TECH_REQUIRED_LABEL) : null}
            skeletonWidth="w-32"
          />
          <AssigneeCell data={data ?? null} />
        </div>
      </div>
    </LoadingWhen>
  );
}
