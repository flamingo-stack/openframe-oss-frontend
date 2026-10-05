'use client';

import { BookOpenIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { routes } from '@/lib/routes';
import type { EmptyStateProps } from './empty-state';

/** Sections whose empty state carries an onboarding-guide footer button. */
export type OnboardingGuideSource =
  'queries' | 'customers' | 'policies' | 'scripts' | 'script-schedules' | 'logs' | 'devices' | 'tickets';

interface OnboardingGuide {
  /** Section noun, spliced into the button label ("… about Script Schedules"). */
  subject: string;
  /**
   * Product Hub slug the guide is authored under — the Help Center route
   * (`EP.onboardingBySlug`) resolves by slug only and 404s on an id.
   */
  slug: string;
}

/**
 * Onboarding guide per section. The button renders only for sections listed
 * here — an unset entry hides it entirely. Some sections intentionally share a
 * guide (queries/policies, scripts/script-schedules).
 */
const ONBOARDING_GUIDES: Partial<Record<OnboardingGuideSource, OnboardingGuide>> = {
  customers: { subject: 'Customers', slug: 'set-up-your-customer-organizations' },
  devices: { subject: 'Devices', slug: 'understanding-the-devices-list' },
  scripts: { subject: 'Scripts', slug: 'scripts-overview' },
  'script-schedules': { subject: 'Script Schedules', slug: 'scripts-overview' },
  policies: { subject: 'Policies', slug: 'what-is-a-monitoring-policy' },
  queries: { subject: 'Queries', slug: 'what-is-a-monitoring-policy' },
  logs: { subject: 'Logs', slug: 'audit-activity-logs' },
  tickets: { subject: 'Tickets', slug: 'how-tickets-begin-with-fae' },
};

type OnboardingGuideButtonProps = Pick<EmptyStateProps, 'buttonLabel' | 'buttonIcon' | 'buttonProps' | 'onButtonClick'>;

/**
 * Footer-button props for a section's `EmptyState`, spread as
 * `<EmptyState … {...onboardingGuideButton('devices')} />`.
 *
 * "Learn more about X" → the section's guide in the in-app Help Center.
 * Returns `{}` (no button) for a section with no guide configured.
 */
export function onboardingGuideButton(source: OnboardingGuideSource): OnboardingGuideButtonProps {
  const guide = ONBOARDING_GUIDES[source];
  if (!guide) return {};

  return {
    buttonLabel: `Learn more about ${guide.subject}`,
    buttonIcon: <BookOpenIcon className="text-ods-text-secondary" />,
    buttonProps: { href: routes.helpCenter.onboardingGuide(guide.slug) },
  };
}
