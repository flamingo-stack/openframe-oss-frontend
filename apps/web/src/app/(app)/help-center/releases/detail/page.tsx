'use client';

import { useSearchParams } from 'next/navigation';
import { ReleaseDetailClient } from './release-detail-client';

/**
 * Product release detail. The slug is a QUERY param, not a path segment: release
 * slugs are CMS content, so `output: 'export'` cannot prerender them (see
 * `routes.helpCenter.release`).
 */
export default function ReleaseDetailRoute() {
  const slug = useSearchParams().get('slug') ?? '';
  return <ReleaseDetailClient slug={slug} />;
}
