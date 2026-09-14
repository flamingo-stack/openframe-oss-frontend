'use client';

import { useEffect, useState } from 'react';

/**
 * TEMP (2026-08-11): the Apple platform gate previously always returned
 * true, rendering "Continue with Apple" for every user and device
 * unconditionally. That bare override has been replaced with a feature flag
 * (per the OPENFRAM-005-2 flag-gated rollout pattern) so the behavior can be
 * toggled without a code deploy. Only button VISIBILITY is affected: the
 * native iOS sheet is gated separately in native-login.ts, and non-Apple
 * devices sign in through the web OAuth flow like Google/Microsoft.
 */
const FORCE_APPLE_PLATFORM_FLAG = 'FEATURE_FORCE_APPLE_PLATFORM';

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent ?? navigator.platform ?? '');
}

export function useIsApplePlatform(): boolean {
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    const forceApplePlatform =
      typeof process !== 'undefined' &&
      process.env?.[FORCE_APPLE_PLATFORM_FLAG] === 'true';

    setIsApple(forceApplePlatform || isApplePlatform());
  }, []);

  return isApple;
}
