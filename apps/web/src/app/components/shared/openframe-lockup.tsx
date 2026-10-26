import { OpenframeLogoIcon, OpenframeTextIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * The OpenFrame logo lockup the full-screen surfaces put on top (the auth status pages, the inactive workspace, the
 * setup wizard's heading, the root error screen and the account deletion pages): the mark beside the wordmark.
 */
export function OpenframeLockup({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-[var(--spacing-system-xsf)]', className)}>
      <OpenframeLogoIcon
        secondaryColor="var(--color-accent-primary)"
        className="h-10 w-auto"
        color="var(--color-text-primary)"
      />
      <OpenframeTextIcon color="var(--color-text-primary)" style={{ width: '144px', height: '24px' }} />
    </div>
  );
}
