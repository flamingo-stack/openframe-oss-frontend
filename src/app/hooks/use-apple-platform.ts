'use client';

/**
 * TEMP (2026-08-11): the Apple platform gate is disabled — "Continue with
 * Apple" renders for every user and device. Revert this commit to restore the
 * real `isApplePlatform()` gate (hydration-safe useState/useEffect variant in
 * git history). Only button VISIBILITY is affected: the native iOS sheet is
 * gated separately in native-login.ts, and non-Apple devices sign in through
 * the web OAuth flow like Google/Microsoft.
 */
export function useIsApplePlatform(): boolean {
  return true;
}
