'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Alert } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRecordingStorage } from '../../hooks/use-session-recordings';
import { formatBytes } from './format';

/**
 * "Recording storage full" on the device page (Figma 2328-20598): the tenant's
 * pool of recordings that are not kept is used up, so new sessions run without
 * recording. The limit is the server's, never a hardcoded size. Renders nothing
 * while storage has room, while it is loading, or where it cannot be read.
 */
export function RecordingStorageBanner({ className }: { className?: string }) {
  const { data: storage } = useRecordingStorage();
  if (!storage?.full) return null;

  return (
    <Alert
      variant="warning"
      className={cn(
        'flex items-center gap-[var(--spacing-system-m)] rounded-[6px] border-ods-warning p-[var(--spacing-system-m)]',
        className,
      )}
    >
      {/* Wrapped: the Alert positions a direct svg child absolutely. */}
      <span className="shrink-0">
        <AlertTriangleIcon className="h-6 w-6" />
      </span>
      <p className="min-w-0 flex-1 text-h3">
        Recording storage full. New sessions aren&apos;t recorded. All {formatBytes(storage.limitBytes)} of recording
        storage is used.
      </p>
    </Alert>
  );
}
