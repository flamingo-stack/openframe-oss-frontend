'use client';

import { CardLoader } from '@flamingo-stack/openframe-frontend-core';

/**
 * Route-level skeleton for `/monitoring/policy` and `/monitoring/query`.
 *
 * Both detail views render `<CardLoader items={4} />` while their REST query is
 * in flight, so the app-shell placeholder renders exactly that — otherwise a
 * cold start shows a generic page skeleton and then swaps to this one.
 */
export function MonitoringDetailSkeleton() {
  return <CardLoader items={4} />;
}
