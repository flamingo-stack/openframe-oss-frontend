import { Loading01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LIVE_PULSE_CLASS } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * Neutral "data is refreshing" strip for device-detail tabs — same geometry as
 * the connecting `WarningBlock` banner, but grey: the data on screen is real,
 * just possibly behind an in-flight sync, so it must not read as a warning.
 */
export function DataSyncBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-[var(--spacing-system-m)] overflow-hidden rounded-[6px] bg-ods-bg-hover p-[var(--spacing-system-s)] text-ods-text-secondary',
        className,
      )}
    >
      {/* A live state (a sync is running), never a loading one: the library's live pulse. */}
      <Loading01Icon className={cn('h-6 w-6 shrink-0', LIVE_PULSE_CLASS)} />
      <p className="min-w-0 flex-1 text-h3">
        Data sync in progress — some information may be outdated until it completes.
      </p>
    </div>
  );
}
