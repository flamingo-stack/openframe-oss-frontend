import { Loading01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
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
        'flex items-start gap-[var(--spacing-system-m)] overflow-hidden rounded-[6px] bg-ods-skeleton p-[var(--spacing-system-s)] text-ods-text-secondary',
        className,
      )}
    >
      <Loading01Icon className="h-6 w-6 shrink-0 animate-spin" />
      <p className="min-w-0 flex-1 text-h3">
        Data sync in progress — some information may be outdated until it completes.
      </p>
    </div>
  );
}
