'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * The backend does not register `tenant-management` yet, and a name it does
 * not know is simply absent from its answer. On the dev server that absence
 * reads as "on" so the mock-backed module can be exercised; an explicit
 * `false` from any backend — a shared one included — still turns it off.
 */
const DEV_FALLBACK = process.env.NODE_ENV === 'development';

/**
 * The one gate for the Tenant Management module (CU-86akj8ajt): the hub card
 * and every page under `/settings/tenant-management`. Tri-state on purpose —
 * `'loading'` renders a skeleton, never a 404 or a missing card (see
 * `use-feature-flag.ts`).
 */
export function useTenantManagementGate(): FeatureFlagGate {
  return useFeatureFlagGate('tenant-management', DEV_FALLBACK);
}
