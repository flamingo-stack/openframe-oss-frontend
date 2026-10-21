'use client';

import { LoadingSuspense, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Component, type ReactNode } from 'react';
import { graphql, useFragment, useLazyLoadQuery } from 'react-relay';
import type { logDrawerDetails_log$key } from '@/__generated__/logDrawerDetails_log.graphql';
import type { logDrawerDetailsQuery as LogDrawerDetailsQueryType } from '@/__generated__/logDrawerDetailsQuery.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { formatLogDetailsRefForCopy, LOG_DETAILS_COPY_LINE_COUNT } from '../utils/format-log-details';

/** The composite key `logDetails` takes; the row carries it, the full log does not ride along. */
const logDrawerDetailsFragment = graphql`
  fragment logDrawerDetails_log on LogEvent {
    toolEventId
    ingestDay
    toolType
    eventType
    timestamp
  }
`;

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
      ...formatLogDetails_log
    }
  }
`;

interface LogDrawerDetailsProps {
  log: logDrawerDetails_log$key;
  /** Shown when the full log cannot be loaded (the row summary). */
  fallback: string;
}

interface LogDrawerDetailsContentProps {
  variables: LogDrawerDetailsQueryType['variables'];
  fallback: string;
}

function LogDrawerDetailsContent({ variables, fallback }: LogDrawerDetailsContentProps) {
  const data = useLazyLoadQuery<LogDrawerDetailsQueryType>(logDrawerDetailsQuery, variables, {
    fetchPolicy: 'store-or-network',
  });

  const log = data.logDetails;
  if (!log) return <>{fallback}</>;

  return <LogDrawerDetailsText text={formatLogDetailsRefForCopy(log)} />;
}

/** The details text; without it (still loading, or in a loading scope) one line per line the formatter writes. */
function LogDrawerDetailsText({ text }: { text?: string }) {
  if (useLoadingScope() || text === undefined) {
    return <TextLineSkeleton type="inherit" lines={LOG_DETAILS_COPY_LINE_COUNT} />;
  }
  return <div className="whitespace-pre-wrap break-words">{text}</div>;
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

/**
 * Full log details block for the "Log Details" drawer — the same content the
 * "Copy Log Details" affordances put on the clipboard, fetched on drawer open.
 */
export function LogDrawerDetails({ log, fallback }: LogDrawerDetailsProps) {
  const { toast } = useToast();
  const { toolEventId, ingestDay, toolType, eventType, timestamp } = useFragment(logDrawerDetailsFragment, log);

  return (
    // Keyed by the composite log identity so a failed boundary resets when
    // another log is selected while the drawer stays mounted.
    <LogDrawerDetailsErrorBoundary
      key={`${toolEventId}:${timestamp}`}
      fallback={fallback}
      onError={error =>
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to load log details'),
          variant: 'destructive',
        })
      }
    >
      <LoadingSuspense label="Loading log details" fallback={<LogDrawerDetailsText />}>
        <LogDrawerDetailsContent
          variables={{ toolEventId, ingestDay, toolType, eventType, timestamp }}
          fallback={fallback}
        />
      </LoadingSuspense>
    </LogDrawerDetailsErrorBoundary>
  );
}
