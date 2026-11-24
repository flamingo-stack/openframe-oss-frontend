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
const ROW_CLASSES =
  'grid grid-cols-1 gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] content-md:min-h-20 content-md:items-center';

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

/** The receiving state's tag and the line under it. */
function ReceivingCell({ data }: { data: SummaryData | null }) {
  const tag = data ? receivingStateTag(data.receivingState) : null;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-[var(--spacing-system-xxs)]">
      <Tag {...(tag ? { label: tag.label, variant: tag.variant } : { label: null })} />
      <LoadingWhen loading={data == null}>
        <p className={cn('truncate text-ods-text-secondary text-h6', data == null && 'w-40')}>
          {data &&
            receivingStateDetailLine({
              receivingState: data.receivingState,
              lastFinishedTestAt: data.lastFinishedTestAt,
            })}
        </p>
      </LoadingWhen>
    </div>
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
  const value =
    data &&
    (sending ? (
      data.supportAddress
    ) : (
      <span className="text-ods-text-secondary">{replyStateLine(data.replyState)}</span>
    ));
  return (
    <InfoCell
      label="Reply as"
      skeletonWidth="w-48"
      icon={provider && sending && <provider.Logo size={24} role="img" aria-label={provider.label} />}
      iconSkeleton={{ size: 'md' }}
      value={value}
    />
  );
}

interface AvatarCellProps {
  label: string;
  /** Null while the record is read: the avatar and the value draw their loading state. */
  person: { name: string; imageUrl?: string } | null | undefined;
  variant: 'square' | 'round';
  /** What a default that is not set reads as. */
  unset: string;
  loading: boolean;
}

/** Default Customer / Default Assignee: the avatar and the name, or what an unset default means. */
function AvatarCell({ label, person, variant, unset, loading }: AvatarCellProps) {
  return (
    <InfoCell
      label={label}
      skeletonWidth="w-36"
      icon={
        (loading || person) && (
          <SquareAvatar
            src={person?.imageUrl}
            alt={person?.name}
            fallback={person?.name ?? ''}
            size="xs"
            variant={variant}
          />
        )
      }
      value={loading ? null : (person?.name ?? unset)}
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
  const data = scoped ? null : (fragment ?? null);
  const loading = data == null;
  const customer = data?.defaultOrganization;
  const assignee = data?.defaultAssignee ? toUserSummary(data.defaultAssignee) : null;
  return (
    <LoadingWhen loading={loading}>
      <div className="flex flex-col rounded-md border border-ods-border bg-ods-card">
        <div className={cn(ROW_CLASSES, 'content-md:grid-cols-2')}>
          <InfoCell label="Forwards to" value={data?.inboundAddress} skeletonWidth="w-56" />
          <ReceivingCell data={data} />
        </div>
        <div className={cn(ROW_CLASSES, 'border-t border-ods-border content-md:grid-cols-2')}>
          <ReplyAsCell data={data} />
          <InfoCell label="Signed in" value={data?.signedInAccount} skeletonWidth="w-48" />
        </div>
        <div className={cn(ROW_CLASSES, 'border-t border-ods-border content-md:grid-cols-3')}>
          <AvatarCell
            label="Default Customer"
            person={
              customer && {
                name: customer.name,
                imageUrl: getFullImageUrl(customer.image?.imageUrl, customer.image?.hash),
              }
            }
            variant="square"
            // No Default Customer: unknown senders are held for review (contract part A, D19).
            unset="None · unknown senders are held"
            loading={loading}
          />
          <InfoCell
            label="Default Status"
            // Not set reads as Tech Required on the server (contract part A, `updateMailbox`).
            value={data ? (data.defaultStatus?.name ?? 'Tech Required') : null}
            skeletonWidth="w-32"
          />
          <AvatarCell
            label="Default Assignee"
            person={assignee && { name: assignee.name, imageUrl: assignee.avatarUrl }}
            variant="round"
            unset="Unassigned"
            loading={loading}
          />
        </div>
      </div>
    </LoadingWhen>
  );
}
