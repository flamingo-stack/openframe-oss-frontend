import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { routeTitle } from '@/lib/route-title';
import ScriptsV2Gate from './scripts-v2-gate';

/** Section title for `/scripts-v2/*` — see `../route-title-layout.tsx`. */
export const metadata: Metadata = { title: routeTitle('Scripts') };

/**
 * Server component so the section can carry that title; the feature-flag gate it
 * used to be lives in `scripts-v2-gate.tsx` now, unchanged, because the gate
 * needs hooks and `metadata` needs a server component.
 */
export default function ScriptsV2Layout({ children }: { children: ReactNode }) {
  return <ScriptsV2Gate>{children}</ScriptsV2Gate>;
}
