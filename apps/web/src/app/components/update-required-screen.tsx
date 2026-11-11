'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { pushBackDismissible } from '@/lib/native-back';
import { appPlugin, onAppResume } from '@/lib/native-shell';
import { checkForUpdate, readUpdateState, restartIntoPendingUpdate } from '@/lib/native-update';
import { openStore, pendingBundleLiftsBlock, useAppUpdateStore } from '@/lib/version-check';
import { DownloadedUpdateRow, StoreUpdateRow } from './store-update-row';

// Just past the minute for which the shell answers `check()` from its last result.
const LOOK_AGAIN_MS = 65_000;

// The pending version the shell refused to restart into, for the life of the
// document: the shell goes on reporting it, and offering it again only gets
// the same refusal. A different pending version is offered as usual.
let refusedPendingVersion: string | null = null;

function offerable(pendingVersion: string | null): string | null {
  return pendingVersion === refusedPendingVersion ? null : pendingVersion;
}

/**
 * The blocking "Update required" screen: the gateway refuses this bundle (426),
 * or the policy says it is below `minBundleVersion`. Replaces the whole app tree,
 * the biometric unlock gate and the login pages included — none of them can
 * reach the API any more.
 *
 * Laid out as the mobile update dialog (a card anchored to the bottom, in thumb
 * reach), with the content of a FORCED update: no dismiss, one action, and where
 * it leads. That is the store, unless the shell's updater (`NativeUpdate`) holds
 * a downloaded bundle that lifts the block: then it is a restart into that
 * bundle, with no store release to wait for.
 */
export function UpdateRequiredScreen() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const minBundleVersion = useAppUpdateStore(s => s.policy?.minBundleVersion);
  const [pendingVersion, setPendingVersion] = useState<string | null>(null);
  const [looksFinished, setLooksFinished] = useState(0);
  const [restarting, setRestarting] = useState(false);
  const canRestart = pendingBundleLiftsBlock(pendingVersion, minBundleVersion);

  // Replaces the whole tree — move focus so assistive tech announces it instead
  // of staying on an element that is no longer rendered.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Android back leaves the app rather than walking SPA history invisibly
  // behind a screen that does not move.
  useEffect(() => pushBackDismissible(() => void appPlugin()?.exitApp()), []);

  // Whether the shell holds a bundle to restart into. If not, ask it to look
  // now: the screen may be up before the shell's own check of this launch has
  // finished, or on a phone that has not asked in a while. A check with a
  // download takes seconds, and the store action stays up through all of it.
  const lookForPendingBundle = useEffectEvent(async () => {
    const held = await readUpdateState();
    if (held) {
      const pending = offerable(held.pendingVersion);
      setPendingVersion(pending);
      if (!pendingBundleLiftsBlock(pending, useAppUpdateStore.getState().policy?.minBundleVersion)) {
        const checked = await checkForUpdate();
        if (checked) setPendingVersion(offerable(checked.pendingVersion));
      }
    }
    setLooksFinished(finished => finished + 1);
  });

  // Asked on mount and on every return to the app, the trip to the store
  // included; the shell answers a repeat within a minute from what it already
  // holds.
  useEffect(() => {
    const look = () => void lookForPendingBundle();
    look();
    return onAppResume(look, 'Update Required');
  }, []);

  // And by itself while there is nothing to restart into: someone who stays on
  // the screen after a failed download never returns to the app, so nothing
  // above asks again. Timed from the end of the last look, which is where the
  // shell's minute starts.
  useEffect(() => {
    if (canRestart) return undefined;
    const timer = setTimeout(() => void lookForPendingBundle(), LOOK_AGAIN_MS);
    return () => clearTimeout(timer);
  }, [canRestart, looksFinished]);

  const restart = async () => {
    setRestarting(true);
    // A restart that works reloads the web view, and this screen with it.
    if (!(await restartIntoPendingUpdate())) {
      refusedPendingVersion = pendingVersion;
      setPendingVersion(null);
    }
    setRestarting(false);
  };

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
        {/* Announced when the action changes under a screen reader that has already read the card. */}
        <p aria-live="polite" className="text-ods-text-primary text-h4">
          {canRestart
            ? 'This version of OpenFrame is no longer supported. The update is ready: restart to keep using the app.'
            : 'This version of OpenFrame is no longer supported. Update to the latest version to keep using the app.'}
        </p>
        {canRestart ? (
          <>
            <DownloadedUpdateRow />
            <Button variant="accent" className="w-full" loading={restarting} onClick={() => void restart()}>
              Restart to Update
            </Button>
          </>
        ) : (
          <>
            <StoreUpdateRow />
            <Button variant="accent" className="w-full" onClick={openStore}>
              Update Now
            </Button>
          </>
        )}
      </section>
    </main>
  );
}
