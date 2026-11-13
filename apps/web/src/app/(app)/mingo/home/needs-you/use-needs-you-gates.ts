'use client';

import { useIncidentsGate } from '@/app/(app)/incidents/hooks/use-incidents-gate';
import { isSaasTenantMode } from '@/lib/app-mode';
import type { NeedsYouGates } from './needs-you-rows';

/**
 * Whether each "Needs you" source exists here, decided like the sidebar entry of the
 * module the row opens (`navigation-config.tsx`): critical incidents on SaaS with
 * `insights`, escalated tickets on SaaS. Approvals have no gate — the notifications they
 * come from exist in every mode.
 *
 * Tri-state on purpose: an unanswered flag is `'loading'`, which the card renders as its
 * loading state. It never stands in for `'off'` (a row missing for no reason) or `'on'`
 * (a request for a module the tenant may not have).
 */
export function useNeedsYouGates(): NeedsYouGates {
  const incidents = useIncidentsGate();
  const tickets = isSaasTenantMode() ? 'on' : 'off';

  return { approvals: 'on', incidents, tickets };
}
