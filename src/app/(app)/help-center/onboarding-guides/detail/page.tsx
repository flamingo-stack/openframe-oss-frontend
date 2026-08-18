'use client';

import { OnboardingGuideDetailView } from '@flamingo-stack/openframe-frontend-core/components/onboarding-guides';
import { useSearchParams } from 'next/navigation';
import { EP, HELP_CENTER_BASE } from '../../endpoints';

/**
 * Onboarding guide detail — config-only. The lib view self-fetches the guide
 * from `EP.onboardingBySlug`; this page supplies only the slug + base path.
 *
 * The slug is a QUERY param, not a path segment: guide slugs are CMS content, so
 * `output: 'export'` cannot prerender them (see `routes.helpCenter.onboardingGuide`).
 */
export default function OnboardingGuideDetailRoute() {
  const slug = useSearchParams().get('slug') ?? '';
  return (
    <OnboardingGuideDetailView
      shell={false}
      slug={slug}
      guideEndpoint={EP.onboardingBySlug}
      basePath={`${HELP_CENTER_BASE}/onboarding-guides`}
    />
  );
}
