'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useSyncExternalStore } from 'react';
import type { DesktopSignInWait } from '@/lib/desktop-sign-in-wait';
import { nativeAuthPlugin } from '@/lib/native-shell';

/** The countdown's only clock: a tick a second while the screen is up. */
function subscribeEverySecond(onTick: () => void): () => void {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}

/** Prerendered HTML is never mid-sign-in, so there is no time to show. */
function noTimeOnServer(): null {
  return null;
}

function formatTimeLeft(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Stands in for the auth form while a desktop sign-in runs in the user's browser, which used to leave
 * the form frozen with a spinner for up to five minutes. Reopen sends the browser to the same sign-in
 * again (a tab closed by mistake) without ending the wait; Cancel ends it in the shell, and the form
 * underneath comes back as it was.
 */
export function DesktopSignInWaiting({ wait }: { wait: DesktopSignInWait }) {
  const { toast } = useToast();
  const secondsLeft = useSyncExternalStore(
    subscribeEverySecond,
    () => Math.max(0, Math.ceil((wait.deadline - Date.now()) / 1000)),
    noTimeOnServer,
  );

  const reopen = () => {
    // The shell sends an https window.open to the default browser, the same exit billing uses.
    window.open(wait.loginUrl, '_blank', 'noopener,noreferrer');
  };

  const cancel = async () => {
    await nativeAuthPlugin()?.cancel?.();
    toast({ title: 'Sign-in canceled', description: 'You can close the browser tab it opened.' });
  };

  // The same card as the core lib's LoginForm, which this stands in for.
  return (
    <div className="flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]">
      <div className="flex flex-col">
        <h1 className="text-ods-text-primary text-h2">Finish signing in your browser</h1>
        <p className="text-ods-text-secondary text-h4">
          We opened your browser to complete sign-in. Come back here once it’s done.
        </p>
      </div>
      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        {wait.email && <p className="text-ods-text-primary text-h4">Signing in as {wait.email}</p>}
        {secondsLeft !== null && (
          <p className="text-ods-text-secondary text-h6" aria-live="off">
            {formatTimeLeft(secondsLeft)} left
          </p>
        )}
      </div>
      <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
        <Button type="button" variant="outline" fullWidth onClick={reopen}>
          Reopen browser
        </Button>
        <Button type="button" variant="transparent" fullWidth onClick={() => void cancel()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
