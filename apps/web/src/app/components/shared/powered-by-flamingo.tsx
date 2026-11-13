'use client';

import { FlamingoMarkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useIsMobileShell } from '@/app/hooks/use-is-mobile-shell';

/**
 * The "Powered by Flamingo" footer the full-screen surfaces share (the setup wizard, the auth status pages, the
 * inactive, deleted and unverified-session screens, the root error screen and the account deletion pages).
 *
 * A link everywhere but the phone apps, where it is the same mark with nothing to tap: flamingo.run carries pricing
 * and a sign-up link, and a store app may not lead to either (the rule behind `isBillingHidden()`). The phone would
 * open it in its in-app browser, so the page would show inside the app.
 *
 * The hook's one frame of the web variant does not happen there: the shell hydrates only the root document, which
 * has no footer, so every footer on a phone is mounted on the client, where the first render already knows the shell.
 */
export function PoweredByFlamingo({ className }: { className?: string }) {
  const mobileShell = useIsMobileShell();
  const classes = cn(
    'flex items-center gap-[var(--spacing-system-xs)] rounded-md bg-transparent p-[var(--spacing-system-m)] text-ods-text-secondary',
    !mobileShell && 'transition-colors hover:bg-ods-bg-hover',
    className,
  );
  const mark = (
    <>
      <span className="text-h6">Powered by</span>
      <FlamingoMarkIcon className="h-5 w-5" color="currentColor" />
      <span className="font-semibold text-code">Flamingo</span>
    </>
  );

  if (mobileShell) {
    return <div className={classes}>{mark}</div>;
  }
  return (
    <a href="https://flamingo.run" target="_blank" rel="noopener noreferrer" className={classes}>
      {mark}
    </a>
  );
}
