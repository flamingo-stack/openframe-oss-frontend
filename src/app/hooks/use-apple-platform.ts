'use client';

import { useEffect, useState } from 'react';
import { isApplePlatform } from '@/lib/platform';

/**
 * Hydration-safe `isApplePlatform()`: false on the prerendered pass, the real
 * device answer after mount. Gates Apple-only auth surfaces (the "Continue
 * with Apple" button) without a server/client markup mismatch.
 */
export function useIsApplePlatform(): boolean {
  const [isApple, setIsApple] = useState(false);
  useEffect(() => {
    setIsApple(isApplePlatform());
  }, []);
  return isApple;
}
