'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useId, useState } from 'react';
import { graphql } from 'react-relay';
import type { cancelSubscriptionModalQuery as CancelSubscriptionModalQueryType } from '@/__generated__/cancelSubscriptionModalQuery.graphql';
import { ContentErrorBoundary, QueryIsland } from '@/app/components/shared';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { CancellationTerms } from './cancellation-terms';
import { DataLossBox } from './data-loss-box';
import { DataLossCoreRows } from './data-loss-core-rows';

/**
 * Two parts of the dialog read the server — when access ends and what keeps
 * working until then, and what the workspace loses. Each part
 * is its own island over this one query, so they paint as they resolve and
 * Relay makes one fetch of it. Flagged modules count on their own queries
 * (`DataLossModuleRows`).
 */
const cancelSubscriptionModalQuery = graphql`
  query cancelSubscriptionModalQuery {
    ...cancellationTerms_query
    ...dataLossCoreRows_query
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
      <ContentErrorBoundary label="CancellationTerms" fallback={() => <></>}>
        <CancellationTermsIsland />
      </ContentErrorBoundary>

      <DataLossBox>
        <ContentErrorBoundary label="DataLossCoreRows" fallback={() => <></>}>
          <DataLossCoreRowsIsland />
        </ContentErrorBoundary>
      </DataLossBox>

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

/** When access ends and what keeps working, with its own boundary: in its scope the reader draws its own loading form. */
function CancellationTermsIsland() {
  return (
    <LoadingSuspense label="Loading the cancellation terms">
      <CancellationTermsReader />
    </LoadingSuspense>
  );
}

function CancellationTermsReader() {
  // In a loading scope (its boundary's fallback) it draws the terms with no data and runs no read.
  if (useLoadingScope()) return <CancellationTerms query={null} />;
  return (
    <QueryIsland<CancelSubscriptionModalQueryType>
      query={cancelSubscriptionModalQuery}
      variables={{}}
      fetchPolicy="store-or-network"
    >
      {data => <CancellationTerms query={data} />}
    </QueryIsland>
  );
}

/**
 * What the workspace loses, with its own boundary: in its scope the reader draws its own loading form. The rows are
 * lines of the box's list, which flattens the fallback's region.
 */
function DataLossCoreRowsIsland() {
  return (
    <LoadingSuspense label="Loading what the workspace loses">
      <DataLossCoreRowsReader />
    </LoadingSuspense>
  );
}

function DataLossCoreRowsReader() {
  // In a loading scope (its boundary's fallback) it draws the rows with no data and runs no read.
  if (useLoadingScope()) return <DataLossCoreRows query={null} />;
  return (
    <QueryIsland<CancelSubscriptionModalQueryType>
      query={cancelSubscriptionModalQuery}
      variables={{}}
      fetchPolicy="store-or-network"
    >
      {data => <DataLossCoreRows query={data} />}
    </QueryIsland>
  );
}
