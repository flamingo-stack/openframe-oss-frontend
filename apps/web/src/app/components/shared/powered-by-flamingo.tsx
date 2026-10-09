import { FlamingoLogo } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * The "Powered by Flamingo" footer link the full-screen surfaces share (the
 * setup wizard; the lock, account-deletion and error screens draw the same
 * row inline).
 */
export function PoweredByFlamingo({ className }: { className?: string }) {
  return (
    <a
      href="https://flamingo.run"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-[var(--spacing-system-xs)] rounded-md bg-transparent p-[var(--spacing-system-m)] text-ods-text-secondary transition-colors hover:bg-ods-bg-hover',
        className,
      )}
    >
      <span className="text-h6">Powered by</span>
      <FlamingoLogo className="h-5 w-5" fill="currentColor" />
      <span className="font-semibold text-code">Flamingo</span>
    </a>
  );
}
