'use client';

import { MingoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { BookOpenIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { routes } from '@/lib/routes';
import type { EmptyStateProps } from './empty-state';

/** Sections whose empty state carries an onboarding-guide footer button. */
export type OnboardingGuideSource =
  | 'queries'
  | 'customers'
  | 'policies'
  | 'scripts'
  | 'script-schedules'
  | 'logs'
  | 'devices'
  | 'tickets';

interface OnboardingGuide {
  /** Section noun, spliced into both button labels ("… about Script Schedules"). */
  subject: string;
  /**
   * Product Hub slug the guide is authored under — the Help Center route
   * (`EP.onboardingBySlug`) resolves by slug only and 404s on an id.
   */
  slug: string;
  /**
   * The row id that slug resolves to. Mingo's `/getting-started display`
   * command takes an id, not a slug; re-derive it with
   *
   *   curl https://product-hub.flamingo.so/api/onboarding-guides/<slug>   → `.id`
   *
   * for a guide that was re-created (a new row = a new id) or renamed.
   * Pinned here rather than resolved at click time so the button stays a plain
   * props builder with no fetch, no loading state, and no failure mode between
   * the click and the chat opening.
   */
  id: string;
}

/**
 * Onboarding guide per section. The button renders only for sections listed
 * here — an unset entry hides it entirely. Some sections intentionally share a
 * guide (queries/policies, scripts/script-schedules).
 */
const ONBOARDING_GUIDES: Partial<Record<OnboardingGuideSource, OnboardingGuide>> = {
  customers: {
    subject: 'Customers',
    slug: 'set-up-your-customer-organizations',
    id: 'd3b5baad-7059-4f4e-936d-25643d085694',
  },
  devices: { subject: 'Devices', slug: 'understanding-the-devices-list', id: '680774a5-cadd-49fd-87c4-115f38341e69' },
  scripts: { subject: 'Scripts', slug: 'scripts-overview', id: '015ca78c-4387-47e8-8db3-3d1bbe177dd9' },
  'script-schedules': {
    subject: 'Script Schedules',
    slug: 'scripts-overview',
    id: '015ca78c-4387-47e8-8db3-3d1bbe177dd9',
  },
  policies: { subject: 'Policies', slug: 'what-is-a-monitoring-policy', id: '37820f75-ec6b-4a70-becf-c788faad8be2' },
  queries: { subject: 'Queries', slug: 'what-is-a-monitoring-policy', id: '37820f75-ec6b-4a70-becf-c788faad8be2' },
  logs: { subject: 'Logs', slug: 'audit-activity-logs', id: 'ce873865-49ba-4124-869e-fccaa5528f85' },
  tickets: { subject: 'Tickets', slug: 'how-tickets-begin-with-fae', id: 'd7f1d9da-052b-4d04-aeb2-070c711612ae' },
};

type OnboardingGuideButtonProps = Pick<EmptyStateProps, 'buttonLabel' | 'buttonIcon' | 'buttonProps' | 'onButtonClick'>;

/**
 * Footer-button props for a section's `EmptyState`, spread as
 * `<EmptyState … {...guideButton} />`.
 *
 * Two shapes, chosen by the `guide-chunks` flag:
 * - **on** → "Ask Mingo about X": opens the Mingo drawer and sends
 *   `/getting-started display "<id>"` into a fresh dialog, so the user gets the
 *   interactive walkthrough for the section they are looking at.
 * - **off** → "Learn more about X": the section's guide in the in-app Help Center.
 *
 * A HOOK, not the plain builder it used to be, because the choice is
 * flag-shaped: flags are not cached, so a snapshot read taken before the query
 * answers renders the Help Center button and never recomputes when the answer
 * arrives. Call it unconditionally at the top of the component and spread the
 * result inside the conditional empty-state branch. Returns `{}` (no button)
 * while the flag is unanswered — the button appearing a beat late is fine,
 * the wrong button is not — and for a section with no guide configured.
 */
export function useOnboardingGuideButton(source: OnboardingGuideSource): OnboardingGuideButtonProps {
  const guideChunksGate = useFeatureFlagGate('guide-chunks');

  const guide = ONBOARDING_GUIDES[source];
  if (!guide) return {};
  if (guideChunksGate === 'loading') return {};

  if (guideChunksGate === 'on') {
    return {
      buttonLabel: `Ask Mingo about ${guide.subject}`,
      buttonIcon: (
        <MingoIcon
          className="size-5"
          eyesColor="var(--ods-flamingo-cyan-base)"
          cornerColor="var(--ods-flamingo-cyan-base)"
        />
      ),
      // The launcher store is read imperatively (`getState()`), which is safe in
      // a handler: the click only writes to it, and `AppLayout` subscribes for
      // the open state.
      onButtonClick: () => {
        useMingoLauncherStore.getState().sendToMingo(`/getting-started display "${guide.id}"`);
      },
    };
  }

  return {
    buttonLabel: `Learn more about ${guide.subject}`,
    buttonIcon: <BookOpenIcon className="text-ods-text-secondary" />,
    buttonProps: { href: routes.helpCenter.onboardingGuide(guide.slug) },
  };
}
