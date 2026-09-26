'use client';

import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadError } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect } from 'react';
import { loadErrorProps } from '@/lib/query-state';
import { describeDeviceLogError, isRetryableDeviceLogError } from '../../../utils/device-log-errors';
import { TabEmptyState } from '../tab-empty-state';

interface AgentLogsErrorStateProps {
  error: unknown;
  hasSearch: boolean;
  retry: () => void;
  /** Lifts a server-rejected search to the box that caused it (spec §8). */
  onSearchRejected?: (message: string | null) => void;
}

/**
 * The list's failed state, chosen by `extensions.code` (spec §8): a vanished
 * device is an empty state without Retry, a rejected filter or search text is
 * a message the user fixes at the control, everything else offers Retry.
 */
export function AgentLogsErrorState({ error, hasSearch, retry, onSearchRejected }: AgentLogsErrorStateProps) {
  const info = describeDeviceLogError(error, { hasSearch });
  const rejected = info.kind === 'search-rejected' ? info.message : null;
  // From an effect, never render: this component renders inside the boundary's
  // own pass, and publishing there would be a cross-component update.
  useEffect(() => {
    onSearchRejected?.(rejected);
    return () => onSearchRejected?.(null);
  }, [rejected, onSearchRejected]);

  switch (info.kind) {
    case 'not-found':
      return (
        <TabEmptyState
          icon={<ClipboardListIcon />}
          title="Device not found"
          description="This device no longer exists or belongs to another workspace."
        />
      );
    // §8 forbids a blank list here: the message now sits at the search box, so
    // the list says what to do next instead of showing the failure twice.
    case 'search-rejected':
      return (
        <TabEmptyState
          icon={<ClipboardListIcon />}
          title="No results for this search"
          description="Adjust the search above and try again."
        />
      );
    case 'validation':
      return <LoadError message={info.message} />;
    default:
      return (
        <LoadError
          {...loadErrorProps(
            info.kind === 'offline',
            info.message,
            isRetryableDeviceLogError(info.kind) ? retry : undefined,
          )}
        />
      );
  }
}
