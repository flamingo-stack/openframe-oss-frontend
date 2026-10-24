'use client';

import { expireParentDomainSessionCookies } from '@flamingo-stack/openframe-frontend-core/platform-domains';

/**
 * Drops the Flamingo hub's Supabase session cookies a browser still holds on `.openframe.ai`.
 *
 * Signing in on hub.openframe.ai used to write the hub's session (two ~3 KB chunks) on the parent
 * domain, so every request to a tenant carried it, and the services behind the gateway answered
 * 400 to every API call once the Cookie header passed their 8 KB limit (CU-17tkuw60ege). The hub
 * now keeps its session host-only; this removes the copies written before that, so an affected
 * browser recovers on its next visit here instead of only on its next visit to the hub.
 *
 * Runs at module load, not in an effect: this module is imported by the root layout, so it runs
 * before any component's effect sends the first API request.
 */
expireParentDomainSessionCookies();

export function ParentDomainSessionCleanup() {
  return null;
}
