'use client';

import { LogCopyIconButton } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { fetchQuery, graphql, useFragment, useRelayEnvironment } from 'react-relay';
import type { logCopyButton_log$key } from '@/__generated__/logCopyButton_log.graphql';
import type { logCopyButtonQuery as LogCopyButtonQueryType } from '@/__generated__/logCopyButtonQuery.graphql';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { formatLogDetailsRefForCopy } from '../utils/format-log-details';

/** The composite key `logDetails` takes — the row carries it, the full log does not ride along. */
const logCopyButtonFragment = graphql`
  fragment logCopyButton_log on LogEvent {
    toolEventId
    ingestDay
    toolType
    eventType
    timestamp
  }
`;

const logCopyButtonQuery = graphql`
  query logCopyButtonQuery(
    $toolEventId: String!
    $ingestDay: String!
    $toolType: String!
    $eventType: String!
    $timestamp: Instant!
  ) {
    logDetails(
      toolEventId: $toolEventId
      ingestDay: $ingestDay
      toolType: $toolType
      eventType: $eventType
      timestamp: $timestamp
    ) {
      ...formatLogDetails_log
    }
  }
`;

/**
 * Table-row "Copy Log Details" button. The full log (message + raw details) is
 * fetched on click — the same `logDetails` the drawer and the log-details page
 * read, so a log the drawer already opened copies straight from the store.
 */
export function LogCopyButton({ log }: { log: logCopyButton_log$key }) {
  const { toolEventId, ingestDay, toolType, eventType, timestamp } = useFragment(logCopyButtonFragment, log);
  const environment = useRelayEnvironment();
  const { toast } = useToast();
  const { copy, copied } = useCopyToClipboard({
    successDescription: 'Log details copied to clipboard',
    errorDescription: 'Unable to copy log details',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = async () => {
    setIsLoading(true);
    try {
      const data = await fetchQuery<LogCopyButtonQueryType>(
        environment,
        logCopyButtonQuery,
        { toolEventId, ingestDay, toolType, eventType, timestamp },
        { fetchPolicy: 'store-or-network' },
      ).toPromise();
      if (data?.logDetails) {
        await copy(formatLogDetailsRefForCopy(data.logDetails));
      }
    } catch (error) {
      toast({
        title: 'Error fetching log details',
        description: getRelayErrorMessage(error, 'Failed to fetch log details'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return <LogCopyIconButton onClick={handleCopy} disabled={isLoading} copied={copied} />;
}
