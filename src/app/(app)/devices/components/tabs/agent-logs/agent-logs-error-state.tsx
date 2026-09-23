'use client';

import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadError } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { loadErrorProps } from '@/lib/query-state';
import { describeDeviceLogError } from '../../../utils/device-log-errors';
import { TabEmptyState } from '../tab-empty-state';

interface AgentLogsErrorStateProps {
  error: unknown;
  hasSearch: boolean;
  retry: () => void;
}

/**
 * The list's failed state, chosen by `extensions.code` (spec §8): a vanished
 * device is an empty state without Retry, a rejected filter or search text is
 * a message the user fixes at the control, everything else offers Retry.
 */
export function AgentLogsErrorState({ error, hasSearch, retry }: AgentLogsErrorStateProps) {
  const info = describeDeviceLogError(error, { hasSearch });
  switch (info.kind) {
    case 'not-found':
      return (
        <TabEmptyState
          icon={<ClipboardListIcon />}
          title="Device not found"
          description="This device no longer exists or belongs to another workspace."
        />
      );
    case 'validation':
    case 'search-rejected':
      return <LoadError message={info.message} />;
    default:
      return <LoadError {...loadErrorProps(info.kind === 'offline', info.message, retry)} />;
  }
}
