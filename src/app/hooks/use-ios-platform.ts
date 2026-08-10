'use client';

import { useEffect, useState } from 'react';
import { isIosPlatform } from '@/lib/platform';

/**
 * Hydration-safe `isIosPlatform()`: false on the prerendered pass, the real
 * device answer after mount. Gates iOS-only auth surfaces (the "Continue
 * with Apple" button) without a server/client markup mismatch.
 */
export function useIsIosPlatform(): boolean {
  const [isIos, setIsIos] = useState(false);
  useEffect(() => {
    setIsIos(isIosPlatform());
  }, []);
  return isIos;
}
