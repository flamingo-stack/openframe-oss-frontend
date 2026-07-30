'use client';

import type { HeaderLoadingCell } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useLocalStorage } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { isSaasTenantMode } from '@/lib/app-mode';
import { featureFlags } from '@/lib/feature-flags';
import { PRIMARY_NAV_SKELETON_KEYS, SECONDARY_NAV_SKELETON_KEYS } from '@/lib/navigation-config';
import {
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_MINIMIZED_STORAGE_KEY,
  SIDEBAR_MINIMIZED_WIDTH,
  SIDEBAR_WIDTH_CSS_VAR,
} from '@/lib/navigation-sidebar-state';
import { runtimeEnv } from '@/lib/runtime-config';
import { GenericPageSkeleton } from './generic-page-skeleton';
import {
  CachedOnboardingTopBar,
  type CachedOnboardingTopBar as CachedOnboardingTopBarData,
  readCachedOnboardingTopBar,
} from './onboarding-top-bar-cache';

/**
 * The trailing header cells a PLACEHOLDER reserves, in the order the live header
 * renders them: time tracker, notifications, then the Mingo launcher. No avatar —
 * the header carries no user cell (`showUser: false`), and reserving one would leave
 * a cell that never fills in.
 *
 * Shared by this skeleton and the `loadingActionCells` the live shell hands the core
 * header, so the two placeholders — this one first as the streaming fallback, then the
 * core header still awaiting flags — reserve the same cluster and it doesn't shift
 * between them.
 *
 * `'wide'` for Mingo is not cosmetic: that cell is content-width (icon + "Mingo AI"
 * wordmark, `gap-2 px-4`), roughly twice a square cell, so reserving a square for it
 * leaves the cluster short and shifts it when the real header lands.
 *
 * Deliberately NOT derived from the feature flags: they are exactly what is still
 * loading, so reading them here would reserve nothing at all. App mode IS known
 * synchronously, and Mingo is a SaaS-tenant surface.
 */
export function headerLoadingCells(): HeaderLoadingCell[] {
  return isSaasTenantMode() ? ['icon', 'icon', 'wide'] : ['icon', 'icon'];
}

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
 * Wide cell — mirrors `HeaderMingoButton`: content-width on mobile, a fixed 140px
 * cell from md. Must match the core placeholder's width exactly, or the cluster
 * shifts when this fallback hands over to it.
 */
function HeaderWideCellSkeleton() {
  return (
    <div className="flex items-center justify-center shrink-0 gap-2 px-4 md:w-[140px] h-full border-l border-ods-border">
      <Skeleton className="h-4 w-4 md:h-6 md:w-6 rounded shrink-0" />
      <Skeleton className="h-5 w-16 md:w-[72px]" />
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

/**
 * One sidebar row skeleton — mirrors NavigationSidebarItemButton (h-14, p-4).
 *
 * The label bar is rendered unconditionally and COLLAPSES ITSELF when the sidebar
 * is minimized: the row is `p-4` (32px) plus a 24px `shrink-0` icon, which is
 * exactly the 56px minimized width, so a `flex-1 min-w-0` sibling resolves to zero
 * there and to the remaining width when expanded. `overflow-hidden` clips its
 * margin. That is what lets this render identically on the server and on the first
 * client paint — the minimized/expanded decision arrives through the width CSS var
 * (seeded pre-paint from localStorage), never through a media query.
 */
function NavigationSidebarRowSkeleton() {
  return (
    <div className="flex items-center justify-start h-14 p-4 overflow-hidden">
      <Skeleton className="h-6 w-6 rounded shrink-0" />
      <Skeleton className="h-4 flex-1 min-w-0 ml-2" />
    </div>
  );
}

/**
 * Breakpoint-dependent geometry, as literal classes so Tailwind's scanner sees
 * them. The numbers are `SIDEBAR_MINIMIZED_WIDTH` (56px = `w-14`) and
 * `SIDEBAR_EXPANDED_WIDTH` (224px = `14rem`, the var's fallback) — keep the two
 * in step; a class string cannot interpolate them.
 */
const SIDEBAR_SKELETON_LAYOUT_CLASSES = [
  // Tablet: float over the content, anchored to the layout ROW (`absolute`
  // inside the shell's `relative` row) — NOT the viewport. Viewport-`fixed` here
  // started the sidebar at y=0 and covered the onboarding announcement bar that
  // sits above the row. Matches the real `NavigationSidebar`, which uses these
  // exact classes for the same reason. Minimized width is pinned here.
  'md:absolute md:inset-y-0 md:left-0 md:z-[45] md:w-14',
  // Desktop: back in flow, width from the persisted preference — the SAME
  // variable the real `NavigationSidebar` reads, with the SAME fallback, so the
  // placeholder and the sidebar that replaces it cannot disagree about how wide
  // they are. The fallback is the whole default: the core lib declares none in
  // `:root`, so a bare reference here would resolve to `width: auto` on any load
  // where the seed script did not run, while the real sidebar still took 14rem.
  'lg:relative lg:inset-auto lg:z-auto lg:h-full lg:w-[var(--of-navigation-sidebar-width,14rem)]',
].join(' ');

/**
 * Sidebar skeleton that tracks the real `NavigationSidebar`:
 * - desktop (lg+): width follows the persisted minimized preference
 * - tablet (md, not lg): always minimized (the real sidebar floats as an
 *   overlay; here we just reserve its 56px slot)
 * - mobile (< md): hidden — the burger menu replaces it
 *
 * EVERY breakpoint decision here is a CSS class, never a media hook. `useMdUp`/
 * `useLgUp` answer `undefined` until an effect has run, so a JS `isTablet` was
 * false on the first render — server included — and a tablet got the DESKTOP
 * branch: an expanded 224px sidebar that snapped to 56px a frame later. The
 * effect made it stick, too, by writing that wrong width into the CSS var and
 * overwriting the correct value the pre-paint seed script had already put there.
 *
 * So the var carries ONE thing — the persisted desktop preference — and the
 * breakpoints decide where it applies. Rows likewise need no media query: each
 * label bar collapses itself at the minimized width (see
 * `NavigationSidebarRowSkeleton`), so they are correct on the first paint.
 */
function NavigationSidebarSkeleton() {
  const [desktopMinimized] = useLocalStorage<boolean>(SIDEBAR_MINIMIZED_STORAGE_KEY, false);
  const width = desktopMinimized ? SIDEBAR_MINIMIZED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  // Keep the var in step with the stored preference once hydrated, so it
  // recovers if the seed script was skipped. No viewport in it any more — that
  // is what the classes above are for.
  useEffect(() => {
    document.documentElement.style.setProperty(SIDEBAR_WIDTH_CSS_VAR, `${width}px`);
  }, [width]);

  return (
    <>
      {/* Tablet reserves the collapsed slot so the content area keeps its
          position while the sidebar floats above it. Rendered unconditionally
          and scoped by classes: gating it on a media hook meant it was missing
          on exactly the first paint, when the sidebar it compensates for had
          already gone `absolute`. */}
      <div className="hidden md:block lg:hidden h-full w-14 shrink-0" aria-hidden />

      <aside
        className={cn(
          'flex-col hidden md:flex shrink-0 bg-ods-card border-r border-ods-border',
          SIDEBAR_SKELETON_LAYOUT_CLASSES,
        )}
        aria-hidden
      >
        {/* Logo header */}
        <div className="flex items-center justify-start h-14 p-4 border-b border-ods-border overflow-hidden">
          <Skeleton className="h-6 w-6 rounded shrink-0" />
          <Skeleton className="h-5 flex-1 min-w-0 ml-2" />
        </div>

        {/* Primary items at top, secondary pinned to the bottom */}
        <div className="flex-1 flex flex-col justify-between py-4 overflow-y-auto">
          <div className="flex flex-col">
            {PRIMARY_NAV_SKELETON_KEYS.map(key => (
              <NavigationSidebarRowSkeleton key={key} />
            ))}
          </div>
          <div className="flex flex-col">
            {SECONDARY_NAV_SKELETON_KEYS.map(key => (
              <NavigationSidebarRowSkeleton key={key} />
            ))}
          </div>
        </div>

        {/* Collapse toggle */}
        <div className="border-t border-ods-border">
          <div className="flex items-center justify-start h-14 p-4 overflow-hidden">
            <Skeleton className="h-6 w-6 rounded shrink-0" />
            <Skeleton className="h-4 flex-1 min-w-0 ml-2" />
          </div>
        </div>
      </aside>
    </>
  );
}

const noop = () => {};

function readOnboardingTopBarPlaceholder(): CachedOnboardingTopBarData | null {
  // Same gate as the live chrome, as a snapshot: this runs from a `useState`
  // initializer and an effect, neither of which may call a hook. Before the flags
  // answer it reports the env default — acceptable here and only here, because
  // the thing being gated IS a placeholder: getting it wrong reserves (or fails to
  // reserve) a band, it can't show wrong chrome or redirect.
  if (!featureFlags.newOnboarding.enabled()) return null;
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
 *   wrapping the neutral page shape.
 *
 * It no longer resolves the CURRENT ROUTE's skeleton. It used to, through a
 * hand-maintained path→component registry, because the gates rendered this
 * INSTEAD of the route — so something here had to know what the route would have
 * painted. The gates now render the real shell with the page inside it (the page
 * shows its own loading state; its data waits on `lib/session-ready.ts`), which
 * left that registry with no caller and a duplicated route table to maintain.
 *
 * What remains here is a transient fallback for a suspension ABOVE the shell,
 * where the route genuinely isn't known yet.
 *
 * Used for:
 * - "Checking session" loading state
 * - "Initializing" loading state
 * - Root layout Suspense fallback
 * - Root page redirect loading
 */
export function AppShellSkeleton() {
  // No feature-flag reads here any more. Gating the header's action cells on the
  // same flags the live header reads looked right, but those flags are precisely
  // what this placeholder is covering: while they are unanswered they all read
  // false, so the row collapsed to nothing beside an empty bar. The cell count now
  // comes from `headerActionCellCount()`, which uses only the synchronously known
  // app mode.

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
          <header className="flex items-center w-full bg-ods-card border-b border-ods-border h-12 md:h-14" aria-busy>
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

            {/* Trailing action cells. Uniform on purpose: the core header's own
                loading state draws the same uniform cells, so the handoff from this
                fallback to it moves nothing. */}
            {headerLoadingCells().map((cell, i) =>
              cell === 'wide' ? <HeaderWideCellSkeleton key={i} /> : <HeaderButtonCellSkeleton key={i} />,
            )}
          </header>

          {/* Main content — same classes as the live layout's <main> (core
            AppLayout base + the mainClassName the (app) layout passes). The
            neutral page shape, not the route's own skeleton: by the time a route
            is known, the real shell is rendering it. */}
          <main className={cn('flex-1 overflow-y-auto', mainClassName)}>
            <GenericPageSkeleton />
          </main>
        </div>
      </div>
    </div>
  );
}
