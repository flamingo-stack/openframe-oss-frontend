'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useRef } from 'react';
import { pushBackDismissible } from '@/lib/native-back';
import { appPlugin } from '@/lib/native-shell';
import { openStore } from '@/lib/version-check';
import { StoreUpdateRow } from './store-update-row';

/**
 * The blocking "Update required" screen: the gateway refuses this bundle (426),
 * or the policy says it is below `minBundleVersion`. Replaces the whole app tree,
 * the biometric unlock gate and the login pages included — none of them can
 * reach the API any more.
 *
 * Laid out as the mobile update dialog (a card anchored to the bottom, in thumb
 * reach), with the content of a FORCED update: no dismiss, one action, and the
 * store it leads to.
 */
export function UpdateRequiredScreen() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Replaces the whole tree — move focus so assistive tech announces it instead
  // of staying on an element that is no longer rendered.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Android back leaves the app rather than walking SPA history invisibly
  // behind a screen that does not move.
  useEffect(() => pushBackDismissible(() => void appPlugin()?.exitApp()), []);

  return (
    // Owns its safe-area insets: it renders outside every chrome root that would
    // otherwise apply them (see `.of-standalone-shell` in globals.css, whose 40px
    // floor is heavier than this card's design margin).
    <main className="flex min-h-screen flex-col justify-end bg-ods-bg px-[var(--spacing-system-lf)] pb-[max(var(--native-safe-bottom,env(safe-area-inset-bottom)),var(--spacing-system-lf))] pt-[max(var(--native-safe-top,env(safe-area-inset-top)),var(--spacing-system-lf))] md:justify-center">
      <section
        aria-labelledby="update-required-title"
        className="mx-auto flex w-full max-w-[480px] flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-xl)]"
      >
        <h1
          id="update-required-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-ods-text-primary text-h2 focus:outline-none"
        >
          Update Required
        </h1>
        <p className="text-ods-text-primary text-h4">
          This version of OpenFrame is no longer supported. Update to the latest version to keep using the app.
        </p>
        <StoreUpdateRow />
        <Button variant="accent" className="w-full" onClick={openStore}>
          Update Now
        </Button>
      </section>
    </main>
  );
}
