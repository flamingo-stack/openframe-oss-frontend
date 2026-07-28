'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Component, type ReactNode, Suspense } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { logDrawerDetailsQuery as LogDrawerDetailsQueryType } from '@/__generated__/logDrawerDetailsQuery.graphql';
import { getErrorMessage } from '@/lib/handle-api-error';
import { formatLogDetailsForCopy } from '../utils/format-log-details';

const logDrawerDetailsQuery = graphql`
  query logDrawerDetailsQuery(
    $ingestDay: String!
    $toolType: String!
    $eventType: String!
    $timestamp: Instant!
    $toolEventId: String!
  ) {
    logDetails(
      ingestDay: $ingestDay
      toolType: $toolType
      eventType: $eventType
      timestamp: $timestamp
      toolEventId: $toolEventId
    ) {
      id
      toolEventId
      eventType
      toolType
      severity
      message
      timestamp
      details
    }
  }
`;

export interface LogDrawerDetailsProps {
  ingestDay: string;
  toolType: string;
  eventType: string;
  timestamp: string;
  toolEventId: string;
  /** Shown when the full log cannot be loaded (the row summary). */
  fallback: string;
}

function LogDrawerDetailsContent({ fallback, ...variables }: LogDrawerDetailsProps) {
  const data = useLazyLoadQuery<LogDrawerDetailsQueryType>(logDrawerDetailsQuery, variables, {
    fetchPolicy: 'store-or-network',
  });

  const log = data.logDetails;
  if (!log) return <>{fallback}</>;

  return (
    <span className="block whitespace-pre-wrap break-words">
      {formatLogDetailsForCopy({
        toolEventId: log.toolEventId,
        eventType: log.eventType,
        toolType: log.toolType,
        severity: log.severity,
        message: log.message ?? undefined,
        timestamp: String(log.timestamp),
        details: log.details ?? undefined,
      })}
    </span>
  );
}

class LogDrawerDetailsErrorBoundary extends Component<
  { fallback: string; onError: (error: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// span-based on purpose: the drawer description slot renders a <p>, so the
// core-lib Skeleton (a <div>) would produce invalid HTML nesting here.
function LogDrawerDetailsSkeleton() {
  return (
    <span className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <span className="block h-5 w-full animate-pulse rounded-md bg-ods-skeleton" />
      <span className="block h-5 w-full animate-pulse rounded-md bg-ods-skeleton" />
      <span className="block h-5 w-3/4 animate-pulse rounded-md bg-ods-skeleton" />
    </span>
  );
}

/**
 * Full log details block for the "Log Details" drawer — the same content the
 * "Copy Log Details" affordances put on the clipboard, fetched on drawer open.
 */
export function LogDrawerDetails(props: LogDrawerDetailsProps) {
  const { toast } = useToast();

  return (
    // Keyed by the composite log identity so a failed boundary resets when
    // another log is selected while the drawer stays mounted.
    <LogDrawerDetailsErrorBoundary
      key={`${props.toolEventId}:${props.timestamp}`}
      fallback={props.fallback}
      onError={error => toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' })}
    >
      <Suspense fallback={<LogDrawerDetailsSkeleton />}>
        <LogDrawerDetailsContent {...props} />
      </Suspense>
    </LogDrawerDetailsErrorBoundary>
  );
}
