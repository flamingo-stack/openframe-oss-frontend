'use client';

import { useEffect } from 'react';
import { captureAttributionFromUrl } from '@/lib/registration-attribution';

/**
 * Persists ad click ids and campaign labels the moment any page loads.
 *
 * This is mounted in the root layout, not the auth layout, on purpose: an ad can land on `/`
 * (or any marketing route) and the visitor only reaches `/auth` by clicking through, at which
 * point `?fbclid=…&utm_source=…` is long gone from the address bar. Capturing at the landing
 * page is the only place the values still exist.
 */
export function RegistrationAttributionCapture() {
  useEffect(() => {
    captureAttributionFromUrl();
  }, []);

  return null;
}
