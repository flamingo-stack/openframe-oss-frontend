'use client';

import { notFound } from 'next/navigation';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';

/**
 * The Software module's gate: every `/software` route reads it first and hands
 * its view `loading` for the window before the flag answers, so the page draws
 * its own loading state — the record's skeleton, not a guess — and no surface
 * the tenant may not have is on screen before the answer.
 *
 * Only a definitive "off" 404s: `notFound()` throws, and throwing while the
 * flags are merely unanswered is unrecoverable (see notifications/page.tsx).
 * The sidebar entry and the Mingo picker read the same flag through the
 * plain hook, where appearing late is fine.
 */
export function useSoftwareManagementGate(): 'loading' | 'on' {
  const gate = useFeatureFlagGate('software-management');
  if (gate === 'off') notFound();
  return gate;
}
