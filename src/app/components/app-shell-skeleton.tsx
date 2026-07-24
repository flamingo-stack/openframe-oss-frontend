'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useLgUp, useLocalStorage, useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect } from 'react';
import DashboardLoading from '@/app/(app)/dashboard/loading';
import { featureFlags } from '@/lib/feature-flags';
import {
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_MINIMIZED_STORAGE_KEY,
  SIDEBAR_MINIMIZED_WIDTH,
  SIDEBAR_WIDTH_CSS_VAR,
} from '@/lib/navigation-sidebar-state';

/**
 * AppHeader action-button cell skeleton — mirrors `HeaderButton`
 * (w-12 md:w-14, full height, centered icon) with a left divider so the cells
 * read like the real header's `divide-x`.
 */
function HeaderButtonCellSkeleton() {
  return (
    <div className="flex items-center justify-center shrink-0 w-12 md:w-14 h-full border-l border-ods-border">
      <Skeleton className="h-4 w-4 md:h-6 md:w-6 rounded" />
    </div>
  );
}

/**
 * Bottom padding the (app) group layout passes to the live `<main>` for
 * standard routes (its `mainClassNameOverride || …` fallback). Defined here —
 * not in app-layout.tsx — because that file imports this one (the skeleton is
 * its loading fallback) and the constant must be shared without a cycle.
 */
export const APP_MAIN_CLASS_NAME = 'pb-14';

// Stable keys for the static row lists — mirrors the SAAS nav (7 primary, 2
// secondary). Used as React keys only; nothing here is rendered.
const PRIMARY_NAV_SKELETON_KEYS = ['dashboard', 'customers', 'devices', 'scripts', 'monitoring', 'logs', 'tickets'];
const SECONDARY_NAV_SKELETON_KEYS = ['knowledge-base', 'settings'];

/** One sidebar row skeleton — mirrors NavigationSidebarItemButton (h-14, p-4). */
function NavigationSidebarRowSkeleton({ showLabel }: { showLabel: boolean }) {
  return (
    <div className="flex items-center justify-start h-14 p-4">
      <Skeleton className="h-6 w-6 rounded shrink-0" />
      {showLabel && <Skeleton className="h-4 flex-1 ml-2" />}
    </div>
  );
}

/**
 * Sidebar skeleton that tracks the real `NavigationSidebar`:
 * - desktop (lg+): width follows the persisted minimized preference
 * - tablet (md, not lg): always minimized (the real sidebar floats as an
 *   overlay; here we just reserve its 56px slot)
 * - mobile (< md): hidden — the burger menu replaces it
 *
 * Content is gated on hydration (media queries are undefined during SSR/first
 * paint), matching how the real sidebar defers rendering its items.
 */
function NavigationSidebarSkeleton() {
  const mdUp = useMdUp();
  const lgUp = useLgUp();
  const [desktopMinimized] = useLocalStorage<boolean>(SIDEBAR_MINIMIZED_STORAGE_KEY, false);

  const isHydrated = mdUp !== undefined && lgUp !== undefined;
  const isTablet = (mdUp ?? false) && !(lgUp ?? false);
  const minimized = isTablet ? true : desktopMinimized;
  const showLabel = !minimized;
  const width = minimized ? SIDEBAR_MINIMIZED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  // The width is driven by the CSS var (seeded pre-paint by the layout's inline
  // script to avoid an expanded→minimized flash on refresh). Keep it in sync
  // once hydrated so it tracks viewport changes and recovers if the seed script
  // was skipped. The aside's `style` string itself is constant, so SSR and
  // first client render match — no hydration mismatch.
  useEffect(() => {
    document.documentElement.style.setProperty(SIDEBAR_WIDTH_CSS_VAR, `${width}px`);
  }, [width]);

  return (
    <>
      {/* Tablet reserves the collapsed slot so the content area keeps its
          position while the real sidebar floats above it. */}
      {isTablet && (
        <div className="hidden md:block h-full shrink-0" style={{ width: SIDEBAR_MINIMIZED_WIDTH }} aria-hidden />
      )}

      <aside
        className={cn(
          'flex-col hidden md:flex shrink-0 bg-ods-card border-r border-ods-border',
          isTablet ? 'fixed top-0 left-0 h-screen z-[45]' : 'relative h-full',
        )}
        style={{ width: `var(${SIDEBAR_WIDTH_CSS_VAR}, ${SIDEBAR_EXPANDED_WIDTH}px)` }}
        aria-hidden
      >
        {isHydrated && (
          <>
            {/* Logo header */}
            <div className="flex items-center justify-start h-14 p-4 border-b border-ods-border">
              <Skeleton className="h-6 w-6 rounded shrink-0" />
              {showLabel && <Skeleton className="h-5 w-24 ml-2" />}
            </div>

            {/* Primary items at top, secondary pinned to the bottom */}
            <div className="flex-1 flex flex-col justify-between py-4 overflow-y-auto">
              <div className="flex flex-col">
                {PRIMARY_NAV_SKELETON_KEYS.map(key => (
                  <NavigationSidebarRowSkeleton key={key} showLabel={showLabel} />
                ))}
              </div>
              <div className="flex flex-col">
                {SECONDARY_NAV_SKELETON_KEYS.map(key => (
                  <NavigationSidebarRowSkeleton key={key} showLabel={showLabel} />
                ))}
              </div>
            </div>

            {/* Collapse toggle */}
            <div className="border-t border-ods-border">
              <div className="flex items-center justify-start h-14 p-4">
                <Skeleton className="h-6 w-6 rounded shrink-0" />
                {showLabel && <Skeleton className="h-4 w-20 ml-2" />}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/**
 * Skeleton that mirrors the AppShell structure:
 * - NavigationSidebar (left): responsive width tracking the real sidebar's
 *   minimized/expanded + tablet states
 * - AppHeader (top of main area): h-12 md:h-14, action cells gated by the same
 *   feature flags
 * - Content area: the real `<main>` classes (APP_MAIN_CLASS_NAME, no own
 *   padding — the native-shell CSS overrides `main.overflow-y-auto`'s inline
 *   padding, so any horizontal padding must live INSIDE, like the live page)
 *   wrapping the dashboard route's own loading state, so this shell is
 *   pixel-identical to the /dashboard skeleton it hands off to.
 *
 * Used for:
 * - "Checking session" loading state
 * - "Initializing" loading state
 * - Root layout Suspense fallback
 * - Root page redirect loading
 */
export function AppShellSkeleton() {
  // Gate the header action cells by the same flags the live `AppHeader` reads,
  // so the skeleton's button row matches what will render once auth resolves.
  const notificationsEnabled = featureFlags.notifications.enabled();
  const timeTrackerEnabled = featureFlags.timeTracker.enabled();
  const mingoEnabled = featureFlags.mingoSidebar.enabled();

  // `app-shell-root`: same native-shell top-inset hook as the live layout
  // (globals.css) — without it the skeleton draws under the status bar.
  return (
    // Plain div, not <output>: the wrapped DashboardLoading already announces
    // itself (role="status" aria-label="Loading dashboard"), and a second
    // nested live region here would double-announce to assistive tech.
    <div className="app-shell-root flex h-screen bg-ods-bg">
      <NavigationSidebarSkeleton />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* AppHeader skeleton - mirrors the real header: h-12 md:h-14, empty
            left spacer, full-height divided action cells on the right. */}
        <header className="flex items-center w-full bg-ods-card border-b border-ods-border h-12 md:h-14">
          {/* Mobile: burger menu cell */}
          <div className="flex md:hidden items-center justify-center shrink-0 w-12 h-full">
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          {/* Mobile: logo cell */}
          <div className="flex md:hidden items-center gap-2 px-3 h-full flex-1 border-l border-ods-border">
            <Skeleton className="h-6 w-6 rounded shrink-0" />
            <Skeleton className="h-4 w-24" />
          </div>
          {/* Desktop: search/spacer slot (empty — this app passes no search) */}
          <div className="hidden md:flex w-full" />

          {timeTrackerEnabled && <HeaderButtonCellSkeleton />}
          {notificationsEnabled && <HeaderButtonCellSkeleton />}

          {/* User avatar — desktop only, like the real header */}
          <div className="hidden md:flex items-center justify-center shrink-0 w-12 md:w-14 h-full border-l border-ods-border">
            <Skeleton className="h-8 w-8 md:h-10 md:w-10 rounded-full" />
          </div>

          {/* Mingo AI — content-width, icon + wordmark (wordmark desktop only) */}
          {mingoEnabled && (
            <div className="flex items-center shrink-0 gap-2 px-4 h-full border-l border-ods-border">
              <Skeleton className="h-4 w-4 md:h-6 md:w-6 rounded" />
              <Skeleton className="hidden md:block h-5 w-16" />
            </div>
          )}
        </header>

        {/* Main content — same classes as the live layout's <main> (core
            AppLayout base + the mainClassName the (app) layout passes). The
            dashboard route's own loading state supplies the padded PageLayout
            chrome and the shared section skeletons, so there is no drift
            between this shell and the route skeleton it transitions into. */}
        <main className={cn('flex-1 overflow-y-auto', APP_MAIN_CLASS_NAME)}>
          <DashboardLoading />
        </main>
      </div>
    </div>
  );
}
