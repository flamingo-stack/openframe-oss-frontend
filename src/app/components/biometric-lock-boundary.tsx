'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { invalidateAuthSession, signOutToLogin } from '@/app/(auth)/auth/hooks/use-auth-session';
import { routes } from '@/lib/routes';
import {
  type BiometricLockState,
  dismissBiometricLock,
  getBiometricLockState,
  subscribeToBiometricLock,
} from '@/lib/token-store';
import { BiometricUnlockGate } from './biometric-unlock-gate';

/**
 * Root-level owner of the native-shell biometric cold-start lock (token-store).
 * Must sit ABOVE every useAuthSession consumer that renders a loading state on
 * `!isReady` (FeatureFlagsGate, AppLayout): while `'locked'` the session query
 * stays in error state, so a consumer higher in the tree would show its
 * skeleton forever and the unlock gate below it would never mount.
 *
 * The lock state is only ever non-null in the native shell — on web/desktop
 * this renders children untouched.
 */
export function BiometricLockBoundary({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const [lock, setLock] = useState<BiometricLockState>(() => getBiometricLockState());
  const [leavingToLogin, setLeavingToLogin] = useState(false);

  useEffect(() => {
    setLock(getBiometricLockState());
    return subscribeToBiometricLock(setLock);
  }, []);

  // Biometric enrollment changed → the Keychain key is gone, tokens are
  // unrecoverable. Same hard sign-out as the card's INVALIDATED path — lands
  // directly on the sign-in flow instead of the "Sign in required" overlay.
  useEffect(() => {
    if (lock === 'invalidated') {
      void signOutToLogin(queryClient, router);
    }
  }, [lock, queryClient, router]);

  // "Log in another way" hand-off: keep rendering the gate until the sign-in
  // route is actually current — releasing on dismiss alone would flash the
  // stale cold-start route (e.g. `/` redirecting by persisted auth state).
  useEffect(() => {
    if (leavingToLogin && pathname?.startsWith(routes.auth.root)) {
      setLeavingToLogin(false);
    }
  }, [leavingToLogin, pathname]);

  const handleUseAnotherLogin = useCallback(async () => {
    setLeavingToLogin(true);
    // Deliberately abandons the locked session: lift the lock first (forceLogout
    // skips cleanup while 'locked'), then run the shared hard sign-out — wipes
    // the stale gated tokens and the auth store, seeds the session query
    // signed-out, and lands on the sign-in flow.
    dismissBiometricLock();
    await signOutToLogin(queryClient, router);
  }, [queryClient, router]);

  // Prompt canceled/failed at cold start: the tokens are still in the Keychain,
  // so this is NOT logged-out — hold the whole app behind the unlock gate and
  // let Retry re-prompt; on success re-drive the auth session check.
  if (lock === 'locked' || leavingToLogin) {
    return (
      <BiometricUnlockGate
        onUnlocked={() => invalidateAuthSession(queryClient)}
        onUseAnotherLogin={handleUseAnotherLogin}
      />
    );
  }

  return <>{children}</>;
}
