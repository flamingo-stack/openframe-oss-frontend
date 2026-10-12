'use client';

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense, useId, useState } from 'react';
import { graphql } from 'react-relay';
import type { cancelSubscriptionModalQuery as CancelSubscriptionModalQueryType } from '@/__generated__/cancelSubscriptionModalQuery.graphql';
import { ContentErrorBoundary, QueryIsland } from '@/app/components/shared';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { CancellationEffectiveDate } from './cancellation-effective-date';
import { DataLossBox } from './data-loss-box';
import { DataLossBoxSkeleton } from './data-loss-box-skeleton';

/**
 * Two parts of the dialog read the server — the date the subscription runs to,
 * and what the workspace loses — with a fixed sentence between them. Each part
 * is its own island over this one query, so they paint as they resolve and
 * Relay makes one fetch of it.
 */
const cancelSubscriptionModalQuery = graphql`
  query cancelSubscriptionModalQuery {
    ...cancellationEffectiveDate_query
    ...dataLossBox_query
  }
`;

export type CancelReason = 'TOO_EXPENSIVE' | 'NOT_USING_ENOUGH' | 'MISSING_FEATURE' | 'TECHNICAL_ISSUES' | 'OTHER';

const REASON_OPTIONS: ReadonlyArray<{ value: CancelReason; label: string }> = [
  { value: 'TOO_EXPENSIVE', label: 'Too expensive' },
  { value: 'NOT_USING_ENOUGH', label: 'Not using it enough' },
  { value: 'MISSING_FEATURE', label: 'Missing a feature' },
  { value: 'TECHNICAL_ISSUES', label: 'Technical issues' },
  { value: 'OTHER', label: 'Other' },
];

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: (reason: CancelReason, comment: string) => void;
}

/**
 * The first step of cancelling: what it costs, and why. Unmounted while closed,
 * so every opening starts from an empty form; the facts are cached in the store
 * (`store-or-network`) rather than refetched every time the dialog opens.
 */
export function CancelSubscriptionModal({
  isOpen,
  isPending = false,
  onClose,
  onConfirm,
}: CancelSubscriptionModalProps) {
  if (!isOpen) return null;

  return <CancelSubscriptionForm isPending={isPending} onClose={onClose} onConfirm={onConfirm} />;
}

function CancelSubscriptionForm({ isPending, onClose, onConfirm }: Omit<CancelSubscriptionModalProps, 'isOpen'>) {
  const [reason, setReason] = useState<CancelReason | ''>('');
  const [comment, setComment] = useState('');
  const reasonId = useId();
  const commentId = useId();

  const handleConfirm = () => {
    if (!reason || isPending) return;
    onConfirm(reason, comment.trim());
  };

  return (
    <SimpleModal
      isOpen
      onClose={onClose}
      className="max-w-[600px]"
      title="Cancel Subscription"
      contentClassName="flex flex-col gap-[var(--spacing-system-l)]"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            Keep Subscription
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleConfirm}
            disabled={!reason || isPending}
            loading={isPending}
          >
            Continue
          </Button>
        </>
      }
    >
      {/* The facts are context, not a gate: a failed read drops them and the
          cancellation can still be confirmed. */}
      <ContentErrorBoundary label="CancellationEffectiveDate" fallback={() => <></>}>
        <Suspense
          fallback={
            <div className="flex gap-[var(--spacing-system-xs)] text-ods-text-primary text-h4">
              <span>Your subscription will remain active until:</span>
              <Skeleton className="h-5 w-20" />
            </div>
          }
        >
          <QueryIsland<CancelSubscriptionModalQueryType>
            query={cancelSubscriptionModalQuery}
            variables={{}}
            fetchPolicy="store-or-network"
          >
            {data => <CancellationEffectiveDate query={data} />}
          </QueryIsland>
        </Suspense>
      </ContentErrorBoundary>
      <p className="text-ods-text-primary text-h4">
        Pay-as-you-go top-ups are disabled immediately. Any usage already accrued will be charged at the end of the
        billing period.
      </p>

      <ContentErrorBoundary label="DataLossBox" fallback={() => <></>}>
        <Suspense fallback={<DataLossBoxSkeleton />}>
          <QueryIsland<CancelSubscriptionModalQueryType>
            query={cancelSubscriptionModalQuery}
            variables={{}}
            fetchPolicy="store-or-network"
          >
            {data => <DataLossBox query={data} />}
          </QueryIsland>
        </Suspense>
      </ContentErrorBoundary>

      <div className="flex flex-col gap-1">
        <label className="text-ods-text-primary text-h3" htmlFor={reasonId}>
          {`What's the main reason you're cancelling?`}
        </label>
        <Select value={reason} onValueChange={v => setReason(v as CancelReason)}>
          <SelectTrigger id={reasonId} className="w-full bg-ods-card">
            <SelectValue placeholder="Select the Reason" />
          </SelectTrigger>
          <SelectContent>
            {REASON_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {reason === 'OTHER' && (
        <div className="flex flex-col gap-1">
          <label className="text-ods-text-primary text-h3" htmlFor={commentId}>
            {`What's on your mind?`}
          </label>
          <Textarea
            id={commentId}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Tell us what's not working for you."
            rows={3}
          />
        </div>
      )}
    </SimpleModal>
  );
}
