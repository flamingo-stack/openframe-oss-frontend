'use client';

import { PageLayout, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ComponentType } from 'react';

/**
 * Resolves the loading skeleton for the CURRENT route, so the app shell
 * skeleton can stand in for the page the user actually asked for.
 *
 * Why this exists: on a cold start the chrome is blocked before any route
 * mounts — `FeatureFlagsGate` waits on the session check plus the server
 * feature flags, and `AppLayoutInner` waits on the session too — so the shell
 * skeleton is what the user looks at for that whole round-trip. It used to
 * hard-code the DASHBOARD skeleton, so every other route showed dashboard cards
 * first and then swapped to its own skeleton before the data landed:
 * dashboard skeleton → page skeleton → page. Picking the route's own skeleton
 * here collapses that to page skeleton → page.
 *
 * Each entry points at a REAL page skeleton owned by that route — the same
 * component the route renders in its own `Suspense`/loading branch — so there
 * is one skeleton per page and no second copy to keep in sync.
 *
 * Entries are lazy on purpose: this module is reachable from the root layout,
 * and the page skeletons legitimately pull in their page's tab definitions and
 * table columns, which would drag most of the app into the initial chunk. The
 * interim fallback is `null` — the chrome around it is already painted, and the
 * skeleton chunk resolves long before the session round-trip it covers for.
 */

export interface RouteSkeletonProps {
  /** `?tab=` — detail pages restore the deep-linked tab's skeleton. */
  tab?: string;
  /** `?viewMode=` — pages with a board/table switch. */
  viewMode?: string;
}

const noop = () => {};

/**
 * Lazily loads a route's page skeleton and presents it under the registry's
 * uniform `RouteSkeletonProps` view.
 *
 * The loader's prop type is deliberately erased: each skeleton declares only
 * the props it actually uses (`activeTab`, `archived`, …) and React drops the
 * rest, so pinning a single prop type across 20 unrelated page skeletons would
 * buy nothing and force a wrapper around every entry.
 */
type SkeletonModule = { default: ComponentType<any> };

function lazySkeleton(loader: () => Promise<SkeletonModule>): ComponentType<RouteSkeletonProps> {
  return dynamic(loader, { ssr: false, loading: () => null });
}

/**
 * Route path → skeleton, matched EXACTLY (modulo the trailing slash).
 *
 * Deliberately not prefix-matched: sibling routes under a shared segment are
 * unrelated pages — `/customers/new` is a form, not the customers list, and
 * `/devices/details/remote-shell` is a terminal, not the device detail page —
 * so a prefix match would confidently show the wrong skeleton. Unlisted routes
 * fall back to the neutral `GenericPageSkeleton`.
 */
const ROUTE_SKELETONS = new Map<string, ComponentType<RouteSkeletonProps>>([
  ['/dashboard', lazySkeleton(() => import('@/app/(app)/dashboard/loading'))],
  // `/` only redirects, and an authenticated boot lands on the dashboard
  // (`getDefaultRedirectPath`) — so its placeholder is the dashboard's.
  ['/', lazySkeleton(() => import('@/app/(app)/dashboard/loading'))],
  [
    '/onboarding',
    lazySkeleton(() =>
      import('@/app/(app)/onboarding/components/onboarding-skeleton').then(m => ({ default: m.OnboardingSkeleton })),
    ),
  ],

  [
    '/devices',
    lazySkeleton(() =>
      import('@/app/(app)/devices/components/devices-page-skeleton').then(m => ({ default: m.DevicesPageSkeleton })),
    ),
  ],
  [
    '/devices/archive',
    lazySkeleton(() =>
      import('@/app/(app)/devices/components/devices-page-skeleton').then(m => ({
        default: function DevicesArchiveSkeleton() {
          return <m.DevicesPageSkeleton archived />;
        },
      })),
    ),
  ],
  [
    '/devices/details',
    lazySkeleton(() =>
      import('@/app/(app)/devices/components/device-details-skeleton').then(m => ({
        default: function DeviceDetailsRouteSkeleton({ tab }: RouteSkeletonProps) {
          return <m.DeviceDetailsSkeleton activeTab={tab} />;
        },
      })),
    ),
  ],
  [
    '/devices/new',
    lazySkeleton(() =>
      import('@/app/(app)/devices/new/new-device-skeleton').then(m => ({ default: m.NewDeviceSkeleton })),
    ),
  ],

  [
    '/customers',
    lazySkeleton(() =>
      import('@/app/(app)/customers/components/customers-page-skeleton').then(m => ({
        default: m.CustomersPageSkeleton,
      })),
    ),
  ],
  [
    '/customers/details',
    lazySkeleton(() =>
      import('@/app/(app)/customers/components/customer-details-skeleton').then(m => ({
        default: function CustomerDetailsRouteSkeleton({ tab }: RouteSkeletonProps) {
          return <m.CustomerDetailsSkeleton activeTab={tab} />;
        },
      })),
    ),
  ],

  [
    '/logs-page',
    lazySkeleton(() =>
      import('@/app/(app)/logs-page/components/logs-page-skeleton').then(m => ({ default: m.LogsPageSkeleton })),
    ),
  ],
  [
    '/log-details',
    lazySkeleton(() =>
      import('@/app/(app)/log-details/components/log-details-skeleton').then(m => ({
        default: function LogDetailsRouteSkeleton() {
          return <m.LogDetailsSkeleton onBack={noop} />;
        },
      })),
    ),
  ],

  [
    '/monitoring',
    lazySkeleton(() =>
      import('@/app/(app)/monitoring/components/monitoring-page-skeleton').then(m => ({
        default: m.MonitoringPageSkeleton,
      })),
    ),
  ],
  [
    '/monitoring/policy',
    lazySkeleton(() =>
      import('@/app/(app)/monitoring/components/monitoring-detail-skeleton').then(m => ({
        default: m.MonitoringDetailSkeleton,
      })),
    ),
  ],
  [
    '/monitoring/query',
    lazySkeleton(() =>
      import('@/app/(app)/monitoring/components/monitoring-detail-skeleton').then(m => ({
        default: m.MonitoringDetailSkeleton,
      })),
    ),
  ],

  [
    '/scripts-v2',
    lazySkeleton(() =>
      import('@/app/(app)/scripts/v2/components/scripts-page-skeleton').then(m => ({ default: m.ScriptsPageSkeleton })),
    ),
  ],
  [
    '/scripts-v2/schedules',
    lazySkeleton(() =>
      import('@/app/(app)/scripts/v2/components/scripts-page-skeleton').then(m => ({
        default: function ScriptSchedulesRouteSkeleton() {
          return <m.ScriptsPageSkeleton view="schedules" />;
        },
      })),
    ),
  ],
  [
    '/scripts-v2/details',
    lazySkeleton(() =>
      import('@/app/(app)/scripts/v2/components/script-page-skeletons').then(m => ({
        default: m.ScriptDetailsPageSkeleton,
      })),
    ),
  ],
  [
    '/scripts-v2/details/run',
    lazySkeleton(() =>
      import('@/app/(app)/scripts/v2/components/script-page-skeletons').then(m => ({
        default: m.RunScriptPageSkeleton,
      })),
    ),
  ],
  [
    '/scripts-v2/edit',
    lazySkeleton(() =>
      import('@/app/(app)/scripts/v2/components/script-page-skeletons').then(m => ({
        default: m.EditScriptPageSkeleton,
      })),
    ),
  ],
  [
    '/scripts-v2/new',
    lazySkeleton(() =>
      import('@/app/(app)/scripts/v2/components/script-page-skeletons').then(m => ({
        default: function NewScriptRouteSkeleton() {
          return <m.EditScriptPageSkeleton mode="new" />;
        },
      })),
    ),
  ],

  [
    '/tickets',
    lazySkeleton(() =>
      import('@/app/(app)/tickets/components/tickets-page-skeleton').then(m => ({ default: m.TicketsPageSkeleton })),
    ),
  ],
  [
    '/tickets/dialog',
    lazySkeleton(() =>
      import('@/app/(app)/tickets/components/ticket-details-skeleton').then(m => ({
        // `showTechnicianChat` is deliberately NOT passed: it defaults to the
        // same feature-flag read the page performs. Hardcoding it here pinned
        // the skeleton to one of the two layouts regardless of the flag.
        default: function TicketDetailsRouteSkeleton() {
          return <m.TicketDetailsSkeleton onBack={noop} />;
        },
      })),
    ),
  ],

  [
    '/knowledge-base',
    lazySkeleton(() =>
      import('@/app/(app)/knowledge-base/components/knowledge-base-page-skeleton').then(m => ({
        default: m.KnowledgeBasePageSkeleton,
      })),
    ),
  ],
  [
    // A folder renders the same list page, scoped to that folder.
    '/knowledge-base/folders',
    lazySkeleton(() =>
      import('@/app/(app)/knowledge-base/components/knowledge-base-page-skeleton').then(m => ({
        default: m.KnowledgeBasePageSkeleton,
      })),
    ),
  ],
  [
    '/notifications',
    lazySkeleton(() =>
      import('@/app/(app)/notifications/components/notifications-page-skeleton').then(m => ({
        default: m.NotificationsPageSkeleton,
      })),
    ),
  ],
  [
    '/worktime',
    lazySkeleton(() =>
      import('@/app/(app)/worktime/components/worktime-page-skeleton').then(m => ({ default: m.WorktimePageSkeleton })),
    ),
  ],

  [
    '/help-center',
    lazySkeleton(() =>
      import('@/app/(app)/help-center/components/help-center-page-skeleton').then(m => ({
        default: m.HelpCenterPageSkeleton,
      })),
    ),
  ],

  [
    '/settings',
    lazySkeleton(() =>
      import('@/app/(app)/settings/components/settings-page-skeleton').then(m => ({ default: m.SettingsPageSkeleton })),
    ),
  ],
  [
    '/settings/billing-usage',
    lazySkeleton(() =>
      import('@/app/(app)/settings/billing-usage/components/billing-usage-skeleton').then(m => ({
        default: m.BillingUsageSkeleton,
      })),
    ),
  ],
  [
    '/settings/billing-usage/subscription',
    lazySkeleton(() =>
      import('@/app/(app)/settings/billing-usage/subscription/components/subscription-settings-skeleton').then(m => ({
        default: m.SubscriptionSettingsSkeleton,
      })),
    ),
  ],
]);

/**
 * The one family where a prefix rule is right: every `/help-center/*` document
 * page is a lib-owned `help-center-pages` mount and they all share the same
 * chrome (an `h1` title with a "Back to Help Center" button), so one skeleton
 * covers the whole subtree — including the dynamic `[slug]` / `[docType]` routes
 * that can't be enumerated. Checked only after the exact map misses.
 */
const PREFIX_SKELETONS: Array<[string, ComponentType<RouteSkeletonProps>]> = [
  [
    '/help-center/',
    lazySkeleton(() =>
      import('@/app/(app)/help-center/components/help-center-page-skeleton').then(m => ({
        default: m.HelpCenterDocSkeleton,
      })),
    ),
  ],
];

const GENERIC_BLOCK_KEYS = ['a', 'b', 'c'] as const;

/**
 * Fallback for routes with no dedicated skeleton (create/edit forms, help
 * center, checkout, legacy scripts): the real `PageLayout` header in its
 * loading state plus neutral content blocks — the shape every page shares, with
 * nothing page-specific that could be wrong.
 */
function GenericPageSkeleton() {
  return (
    <PageLayout loading className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      {GENERIC_BLOCK_KEYS.map(key => (
        <Skeleton key={key} className="h-20 w-full rounded-[6px]" />
      ))}
    </PageLayout>
  );
}

/** Exact lookup, tolerating the app's `trailingSlash: true` paths. */
function resolveRouteSkeleton(pathname: string): ComponentType<RouteSkeletonProps> {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const exact = ROUTE_SKELETONS.get(path);
  if (exact) return exact;
  return PREFIX_SKELETONS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? GenericPageSkeleton;
}

/**
 * Renders the current route's page skeleton. Mount inside a `Suspense`
 * boundary — `useSearchParams` requires one.
 */
export function RouteContentSkeleton() {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const RouteSkeleton = resolveRouteSkeleton(pathname);

  return (
    <RouteSkeleton tab={searchParams.get('tab') ?? undefined} viewMode={searchParams.get('viewMode') ?? undefined} />
  );
}
