'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useLgUp, useLocalStorage, useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { featureFlags, skeletonFlagEnabled } from '@/lib/feature-flags';
import {
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_MINIMIZED_STORAGE_KEY,
  SIDEBAR_MINIMIZED_WIDTH,
  SIDEBAR_WIDTH_CSS_VAR,
} from '@/lib/navigation-sidebar-state';
import { runtimeEnv } from '@/lib/runtime-config';
import {
  CachedOnboardingTopBar,
  type CachedOnboardingTopBar as CachedOnboardingTopBarData,
  readCachedOnboardingTopBar,
} from './onboarding-top-bar-cache';
import { RouteContentSkeleton } from './route-content-skeleton';

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

/**
 * Per-route `<main>` padding overrides. Lives here, beside
 * `APP_MAIN_CLASS_NAME` and for the same reason: the (app) group layout imports
 * this file, so the constants must be shared without a cycle.
 *
 * Both the live layout AND this skeleton apply it. They MUST agree — a route
 * whose real `<main>` drops the 56px bottom padding but whose skeleton keeps it
 * gives the skeleton a shorter content box, so full-height pages (the tickets
 * board) visibly resize on the handoff.
 */
export function getMainClassNameOverride(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  if (pathname.startsWith('/mingo')) return 'p-0 md:p-0';
  if (pathname.startsWith('/devices/details/file-manager')) return 'pb-0 md:pb-0';
  if (pathname.startsWith('/tickets')) return 'pb-0 md:pb-0';
  if (pathname.startsWith('/settings')) return 'pb-0 md:pb-0';
  return undefined;
}

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
          // Tablet: float over the content, anchored to the layout ROW
          // (`absolute` inside the shell's `relative` row) — NOT the viewport.
          // Viewport-`fixed` here started the sidebar at y=0 and covered the
          // onboarding announcement bar that sits above the row. Matches the
          // real `NavigationSidebar`, which uses these exact classes for the
          // same reason.
          isTablet ? 'absolute inset-y-0 left-0 z-[45]' : 'relative h-full',
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

const noop = () => {};

function readOnboardingTopBarPlaceholder(): CachedOnboardingTopBarData | null {
  // Same gate as the live chrome. `skeletonFlagEnabled` (not `featureFlags`)
  // so the cached server answer wins over the env default.
  if (!skeletonFlagEnabled('new-onboarding', runtimeEnv.newOnboardingFlag())) return null;
  return readCachedOnboardingTopBar();
}

/**
 * Set by the first mount's effect. The read above is localStorage-derived and
 * therefore unavailable on the server, so the FIRST client render must return
 * null to match the SSR'd HTML — anything else is a hydration mismatch that
 * re-renders the whole tree. That constraint applies only once: this skeleton
 * remounts on every later client-side gate (feature flags, subscription,
 * biometric lock, session checks, Suspense), where there is no server HTML to
 * agree with and deferring would just reintroduce the one-frame bandless render
 * this cache exists to prevent.
 */
let hasHydrated = false;

/**
 * The onboarding banner the live layout will render in its `topBar` slot,
 * replayed from cache so the shell reserves the band up front instead of
 * letting it drop in late and push the whole app down.
 *
 * Inert while loading: `onStart` is a no-op and pointer events are off, so a
 * click on a placeholder CTA can't navigate before the app is ready.
 */
function useOnboardingTopBarPlaceholder(pathname: string | null): React.ReactNode {
  const [cached, setCached] = useState<CachedOnboardingTopBarData | null>(() =>
    hasHydrated ? readOnboardingTopBarPlaceholder() : null,
  );
  useEffect(() => {
    // Unconditional and idempotent rather than `if (hasHydrated) return`: the
    // flag is module-scope but the state it guards is per-instance, so an early
    // return would strand any instance that initialized while the flag was
    // false and mounted after another instance had flipped it — that one would
    // never read the cache at all. `prev ?? …` keeps the remount path free (the
    // initializer already read, so this is a same-reference no-op React bails
    // out of) without depending on which instance got here first.
    hasHydrated = true;
    setCached(prev => prev ?? readOnboardingTopBarPlaceholder());
  }, []);

  if (!cached) return null;

  return (
    <div className="contents pointer-events-none">
      <CachedOnboardingTopBar cached={cached} pathname={pathname} onStart={noop} />
    </div>
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
 *   wrapping the CURRENT ROUTE's own loading state via `RouteContentSkeleton`,
 *   so this shell is pixel-identical to the page skeleton it hands off to —
 *   whichever page that is.
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

  // The live `<main>` takes a per-route padding override; apply the same one
  // here or full-height pages get a different content box in the skeleton.
  const pathname = usePathname();
  const mainClassName = getMainClassNameOverride(pathname) || APP_MAIN_CLASS_NAME;
  const topBar = useOnboardingTopBarPlaceholder(pathname);

  // `app-shell-root`: same native-shell top-inset hook as the live layout
  // (globals.css) — without it the skeleton draws under the status bar.
  return (
    // Plain div, not <output>: the route skeletons announce themselves where it
    // matters (e.g. DashboardLoading's role="status"), and a second nested live
    // region here would double-announce to assistive tech.
    //
    // Structure mirrors core `AppLayout`: a column whose optional full-width
    // topBar sits ABOVE the sidebar + header row. The row must be its own
    // element (not the root) so the banner spans the sidebar too.
    <div className="app-shell-root flex flex-col h-screen bg-ods-bg">
      {topBar}

      <div className="flex flex-1 min-h-0 relative">
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
            CURRENT ROUTE's own loading state supplies the padded PageLayout
            chrome and its section/table skeletons, so there is no drift
            between this shell and the route skeleton it transitions into.
            The Suspense boundary is required: RouteContentSkeleton reads
            `useSearchParams`, and it also covers the lazy skeleton chunk. */}
          <main className={cn('flex-1 overflow-y-auto', mainClassName)}>
            <Suspense fallback={null}>
              <RouteContentSkeleton />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
