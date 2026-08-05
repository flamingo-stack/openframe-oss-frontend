'use client';

import { MingoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import type { EmptyStateProps } from './empty-state';

/** Sections whose empty state carries an "Ask Mingo about X" footer button. */
export type AskMingoSource =
  | 'queries'
  | 'customers'
  | 'policies'
  | 'scripts'
  | 'script-schedules'
  | 'logs'
  | 'devices'
  | 'tickets';

/**
 * The section's onboarding guide, as BOTH the Product Hub slug it is authored
 * under and the row id that slug resolves to. The button sends the id (the
 * `/getting-started display` command takes an id, not a slug); the slug is kept
 * alongside it because it is the only human-readable handle on the guide and
 * the way these ids are (re)derived:
 *
 *   curl https://product-hub.flamingo.so/api/onboarding-guides/<slug>   → `.id`
 *
 * (In-app the same row is served through the `/content` proxy —
 * `EP.onboardingBySlug(slug)` — which resolves by slug only and 404s on an id.)
 *
 * Ids are pinned here on purpose rather than resolved at click time: it keeps
 * the button a plain synchronous props builder with no fetch, no loading state,
 * and no failure mode between the click and the chat opening. Re-run the curl
 * above for a section whose guide was re-created (a new row = a new id) or
 * whose slug changed. Some sections intentionally share a guide
 * (queries/policies, scripts/script-schedules); a section missing here renders
 * no button at all.
 */
const GETTING_STARTED_GUIDES: Partial<Record<AskMingoSource, { slug: string; id: string }>> = {
  customers: { slug: 'set-up-your-customer-organizations', id: 'd3b5baad-7059-4f4e-936d-25643d085694' },
  devices: { slug: 'understanding-the-devices-list', id: '680774a5-cadd-49fd-87c4-115f38341e69' },
  scripts: { slug: 'scripts-overview', id: '015ca78c-4387-47e8-8db3-3d1bbe177dd9' },
  'script-schedules': { slug: 'scripts-overview', id: '015ca78c-4387-47e8-8db3-3d1bbe177dd9' },
  policies: { slug: 'what-is-a-monitoring-policy', id: '37820f75-ec6b-4a70-becf-c788faad8be2' },
  queries: { slug: 'what-is-a-monitoring-policy', id: '37820f75-ec6b-4a70-becf-c788faad8be2' },
  logs: { slug: 'audit-activity-logs', id: 'ce873865-49ba-4124-869e-fccaa5528f85' },
  tickets: { slug: 'how-tickets-begin-with-fae', id: 'd7f1d9da-052b-4d04-aeb2-070c711612ae' },
};

type AskMingoButtonProps = Pick<EmptyStateProps, 'buttonLabel' | 'buttonIcon' | 'onButtonClick'>;

/**
 * Footer-button props for a section's `EmptyState`, spread as
 * `{...askMingoButton('customers', 'Ask Mingo about Customers')}`.
 *
 * Clicking opens the Mingo drawer and sends `/getting-started display "<id>"`
 * into a fresh dialog, so the user gets the interactive walkthrough for the
 * section they are looking at instead of an empty screen.
 *
 * A plain function, NOT a hook — call sites spread it inside a conditional
 * empty-state branch, where a hook would break the rules of hooks. The launcher
 * store is read imperatively (`getState()`), which is safe outside React: the
 * click only writes to the store, and `AppShell` subscribes to it for the open
 * state. Returns `{}` (no button) when the section has no guide in
 * `GETTING_STARTED_GUIDES`.
 */
export function askMingoButton(source: AskMingoSource, label: string): AskMingoButtonProps {
  const guide = GETTING_STARTED_GUIDES[source];
  if (!guide) return {};
  return {
    buttonLabel: label,
    buttonIcon: (
      <MingoIcon
        className="size-5"
        eyesColor="var(--ods-flamingo-cyan-base)"
        cornerColor="var(--ods-flamingo-cyan-base)"
      />
    ),
    onButtonClick: () => {
      useMingoLauncherStore.getState().sendToMingo(`/getting-started display "${guide.id}"`);
    },
  };
}
