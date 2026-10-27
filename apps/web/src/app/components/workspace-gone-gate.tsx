'use client';

import { Logout01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { signOutToLogin } from '@/app/(auth)/auth/hooks/use-auth-session';
import { resetSessionHealth, useSessionHealthStore } from '@/lib/session-health';
import { OpenframeLockup } from './shared/openframe-lockup';
import { PoweredByFlamingo } from './shared/powered-by-flamingo';

/**
 * Blocks the app once the gateway answers 410 (`session-health.ts`): the tenant
 * was deleted, and nothing under it can reach an API any more. Replaces the tree
 * the way `AppUpdateGate` does, which also unmounts every poller and socket
 * below it.
 */
export function WorkspaceGoneGate({ children }: { children: ReactNode }) {
  const gone = useSessionHealthStore(s => s.health === 'gone');
  return gone ? <WorkspaceGoneScreen /> : children;
}

function WorkspaceGoneScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Replaces the whole tree — move focus so assistive tech announces it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // The shared sign-out: clears the tokens (and the shell's custody of them) and
  // lands on the sign-in flow. Not the confirm-modal path — that modal belongs to
  // the app shell, which is not mounted here.
  const signOut = async () => {
    setSigningOut(true);
    await signOutToLogin(queryClient, router);
    resetSessionHealth();
  };

  return (
    <main className="of-standalone-shell flex min-h-screen flex-col items-center justify-between bg-ods-bg p-[var(--spacing-system-xl)]">
      <OpenframeLockup />

      <div className="flex w-full max-w-[600px] flex-col items-center gap-[var(--spacing-system-xl)]">
        <div className="flex flex-col gap-[var(--spacing-system-xs)] text-center">
          <h1 ref={headingRef} tabIndex={-1} className="text-ods-text-primary text-h2 focus:outline-none">
            Workspace deleted
          </h1>
          <p className="text-ods-text-secondary text-h4">
            This OpenFrame workspace has been deleted, so its data is no longer available. Sign out to continue with
            another workspace.
          </p>
        </div>

        <Button variant="accent" leftIcon={<Logout01Icon />} loading={signingOut} onClick={signOut}>
          Sign Out
        </Button>
      </div>

      <PoweredByFlamingo />
    </main>
  );
}
