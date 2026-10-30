'use client';

import { useOptionalNotifications } from '@flamingo-stack/openframe-frontend-core';
import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { AppLayout as CoreAppLayout } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { TicketLiveProvider } from '@flamingo-stack/openframe-frontend-core/components/tickets';
import { TabNavigationVariantProvider } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { NavigationSidebarConfig } from '@flamingo-stack/openframe-frontend-core/types/navigation';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardOverviews } from '@/app/(app)/dashboard/components/dashboard-content';
import { MingoNewChat } from '@/app/(app)/mingo/home/mingo-new-chat';
import { MingoChatProvider } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { countCompleted, USER_ONBOARDING_STEPS } from '@/app/(app)/onboarding/onboarding-steps';
import { useSetupPending } from '@/app/(app)/setup/hooks/use-setup-pending';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useLogoutConfirmStore } from '@/app/(auth)/auth/stores/logout-confirm-store';
import { DesktopUpdateModal } from '@/app/components/desktop-update-modal';
import { HydratorBoundary } from '@/app/components/shared/hydrator-boundary';
import { LogoutConfirmModal } from '@/app/components/shared/logout-confirm-modal';
import { SidebarUpdateButton } from '@/app/components/sidebar-update-button';
import { useFeatureFlag, useFeatureFlagGate, useFeatureFlagsReady } from '@/app/hooks/use-feature-flag';
import { isBillingHidden, isBillingReadOnly } from '@/lib/billing-visibility';
import { getFullImageUrl } from '@/lib/image-url';
import { useNativeBackDismissible } from '@/lib/native-back';
import { isAppShell } from '@/lib/platform';
import { MANAGE_AI_BALANCE_ACTION, routes } from '@/lib/routes';
import { dismissTrialBar, isTrialBarDismissed } from '@/lib/trial-bar-dismissal';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { isAuthOnlyMode, isOssTenantMode, isSaasTenantMode } from '../../lib/app-mode';
import {
  getGroupedNavigationItems,
  getNavigationItems,
  NAVIGATION_LOADING_ROWS,
  type NavigationFlags,
} from '../../lib/navigation-config';
import { GROUPED_SIDEBAR_EXPANDED_WIDTH } from '../../lib/navigation-sidebar-state';
import { AnnouncementTopBar } from './announcement-top-bar';
import {
  APP_MAIN_CLASS_NAME,
  headerLoadingCells,
  holdsDashboard,
  isBareChromeRoute,
  mingoHeaderLoadingCells,
} from './app-shell-chrome';
import { AiBalanceBar, BillingBarsHydrator, type BillingBarsState, NO_BARS, TrialEndingBar } from './billing-bars';
import { BiometricEnrollPrompt } from './biometric-enroll-prompt';
import { useHistorySearchStore } from './mingo-shell/history-search-store';
import { MingoAccountPopover } from './mingo-shell/mingo-account-popover';
import { MingoComposerDock } from './mingo-shell/mingo-composer-dock';
import { MingoComposerSheet } from './mingo-shell/mingo-composer-sheet';
import { composerRouteOf, dockViewOf } from './mingo-shell/mingo-dock-route';
import { isListUp, isSheetUp, useMingoSheetStore } from './mingo-shell/mingo-sheet-store';
import { MingoSidebarControls } from './mingo-shell/mingo-sidebar-controls';
import { MingoHistorySearch, MingoSidebarHistorySlot } from './mingo-shell/mingo-sidebar-history';
import { MingoSidebarRows } from './mingo-shell/mingo-sidebar-rows';
import { useMobileMenuStore } from './mingo-shell/mobile-menu-store';
import { forwardsKeyboard, useHistorySearchShortcut } from './mingo-shell/use-history-search-shortcut';
import { useSidebarCollapsed } from './mingo-shell/use-sidebar-collapsed';
import { NativePushInitializer } from './native-push-initializer';
import { type UnreadCountsByCategory, UnreadCountsHydrator } from './notifications/unread-counts-hydrator';
import { OnboardingCoachMark } from './onboarding-coach-mark';
import { OnboardingProgressHydrator } from './onboarding-progress-hydrator';
import { OnboardingV2Redirect } from './onboarding-v2-redirect';
import { PresenceHeartbeat } from './presence-heartbeat';
import { SessionHealthWatcher } from './session-health-watcher';
import { SubscriptionGuard, useSubscriptionLock } from './subscription-lock/subscription-guard';
import { SubscriptionLockContent } from './subscription-lock/subscription-lock-content';
import { isRouteOpenWhileLocked } from './subscription-lock/subscription-status';
import { SuperUserBanner } from './super-user-banner';
import { TimeTrackerHostProvider } from './time-tracker-host-provider';
import { UnauthorizedOverlay } from './unauthorized-overlay';
import { WalkthroughVideo } from './walkthrough-video';

/**
 * How long the chrome may wait for the answers it renders from before giving up
 * and drawing itself anyway. Sized like the session latch's own fail-open in
 * `lib/session-ready.ts`: longer than any healthy pair of round trips, shorter
 * than a user's patience.
 */
const CHROME_LOADING_FAIL_OPEN_MS = 10_000;

/**
 * `loading`, but never forever.
 *
 * The chrome's loading state is a latch over two async answers, and a latch with
 * no way out is one missing terminal outcome away from a permanent skeleton —
 * which is exactly what shipped: a store reset that arrived after hydration left
 * the sidebar and header loading for the rest of the session while the page
 * content worked normally. That specific cause is fixed at its source, but the
 * SHAPE of the bug is what this closes. `lib/session-ready.ts` spells out the
 * same rule for the request gate ("THIS GATE IS AN OPTIMIZATION AND MUST FAIL
 * OPEN"); the chrome's gate is the same kind of optimization and earns the same
 * predicate.
 *
 * Failing open degrades rather than breaks: the nav renders from whatever the
 * flags currently read (their env defaults, if nothing answered) and without the
 * onboarding entry. That is a nav that may be missing a row, against a rail of
 * grey placeholders that never resolves — and unlike the skeleton, it recovers
 * on its own the moment a real answer lands.
 */
function useFailOpen(loading: boolean, afterMs: number): boolean {
  const [failedOpen, setFailedOpen] = useState(false);

  // Re-arm during render: a later load gets its own full window rather than
  // inheriting a previous timeout's verdict, and doing it here means the chrome
  // is never drawn once in the failed-open state after a fresh load begins.
  const [wasLoading, setWasLoading] = useState(loading);
  if (loading !== wasLoading) {
    setWasLoading(loading);
    if (!loading) setFailedOpen(false);
  }

  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => setFailedOpen(true), afterMs);
    return () => clearTimeout(timer);
  }, [loading, afterMs]);

  return loading && !failedOpen;
}

/**
 * The `/setup` wizard's shell: the page alone, full screen. Carries the same
 * `app-shell-root` hook as the core layout's root so the native safe-area
 * insets land once, on the root, exactly as they do around the chrome.
 */
function BareAppShell({ children }: { children: React.ReactNode }) {
  return <div className="app-shell-root flex min-h-screen flex-col bg-ods-bg">{children}</div>;
}

function AppShell({ children, mainClassName }: { children: React.ReactNode; mainClassName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // Which shell this is: a SaaS tenant's is Mingo-first (Mingo home, chats as pages,
  // the composer docked under every page); an OSS tenant has no Mingo and keeps the
  // dashboard shell. App mode is known before the first paint, so the chrome never
  // waits for it.
  const mingoShell = isSaasTenantMode();

  // The shell now mounts BEFORE the session resolves (see `AppLayoutInner`), so it
  // owns two things it used to get for free from being rendered only afterwards:
  // the user chrome fills in instead of being present from the start, and every
  // fetching child below is gated on this — a hydrator firing before `/me` has
  // answered would 401 into the refresh/force-logout path.
  const { isReady: sessionResolved, isAuthenticated } = useAuthSession();
  const sessionReady = sessionResolved && isAuthenticated;

  const userFirstName = useAuthStore(state => state.user?.firstName);
  const userLastName = useAuthStore(state => state.user?.lastName);
  const userEmail = useAuthStore(state => state.user?.email);
  const userRole = useAuthStore(state => state.user?.role);
  const userImageUrl = useAuthStore(state => state.user?.image?.imageUrl);
  const userImageHash = useAuthStore(state => state.user?.image?.hash);

  // The chat identity, for the dock's `ChatIdentityProvider`. Not in the native
  // shells: identity rides the `/content` proxy, which `embedAuthedFetch` refuses
  // from the capacitor:// origin — a SYNCHRONOUS throw inside the resolver effect
  // that unmounts the whole shell. The lib's designed fallback is anon identity.
  const chatIdentityEnabled = !isAppShell();

  const handleNavigate = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router],
  );

  const openLogoutConfirm = useLogoutConfirmStore(state => state.open);
  const logoutOpen = useLogoutConfirmStore(state => state.isOpen);
  const closeLogout = useLogoutConfirmStore(state => state.close);

  const handleLogout = useCallback(() => {
    openLogoutConfirm();
  }, [openLogoutConfirm]);

  // Android hardware/gesture back dismisses an open overlay before navigating
  // the SPA history (native-back.ts). iOS uses the WKWebView edge-swipe.
  useNativeBackDismissible(logoutOpen, closeLogout);

  // Notifications context (provided by NotificationsDataProvider in the root
  // layout). Read via ref so the pathname effect below doesn't depend on the
  // context value's render-to-render identity.
  const notificationsCtx = useOptionalNotifications();
  const closeNotificationsRef = useRef(notificationsCtx?.close);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    closeNotificationsRef.current = notificationsCtx?.close;
  });

  // Close the notifications drawer on route navigation. It is non-modal (header
  // and sidebar stay interactive while open), so clicking a nav link should land
  // the user on the new page rather than leaving a panel covering it. The lib
  // leaves this pathname-driven close to the embedder (it has no router), so
  // we own it here. Runs on `pathname` change; the initial no-op (already
  // closed) is harmless - React bails on a same-value `setState`.
  //
  // The Mingo-first shell counts a query change as a navigation too: its chat pages
  // differ only by `?id=`, and moving to another chat from the sidebar history must
  // not leave the drawer over it. (That shell's phone drawer closes on the same
  // trigger inside the layout, which watches `sidebarConfig.currentPath`.)
  //
  // `locationKey` is the intentional trigger but isn't read in the body — the
  // close action is read imperatively, so it isn't a dependency of it.
  const locationKey = mingoShell ? `${pathname}?${search}` : pathname;
  useEffect(() => {
    closeNotificationsRef.current?.();
  }, [locationKey]);

  // The lock screen renders INSIDE this shell — the chrome stays up on every lock
  // screen, `disabled`, since nothing it leads to is reachable while the lock
  // holds. It briefly did the opposite (`b13fc05` replaced the shell outright);
  // the layout is required, so the swap is back in `<main>` where it started.
  //
  // Two different questions, and they answer differently on the pages a lock
  // leaves open (`isRouteOpenWhileLocked`: checkout results, and Billing & Usage
  // on PAST_DUE):
  //   - `showLockContent` — does the lock screen belong in `<main>`? Not on
  //     those pages.
  //   - `isLocked` — is the subscription gate holding this workspace's data? That
  //     is route-blind, so every chrome hydrator below gates on THIS. On those
  //     pages their requests are parked exactly as they are anywhere else.
  //
  // There is deliberately NO "still resolving" placeholder for the page area.
  // `children` render immediately — before the session and before the
  // subscription answer — and show their OWN loading state, because every app
  // data request waits on the session latch (`lib/session-ready.ts`) rather than
  // on this tree. That is what removed the route→skeleton registry: the mapping
  // from a page to its skeleton lives in the page, once.
  //
  // The trade-off is on the lock: a locked workspace sees its page's skeleton for
  // the length of the subscription round-trip before the lock screen swaps in.
  // The lock is UX, not enforcement (the API refuses the data either way), and
  // the query is `store-and-network`, so the window exists only on a cold store.
  const { isLocked, status: subscriptionStatus } = useSubscriptionLock();
  const showLockContent = isLocked && !isRouteOpenWhileLocked(pathname, subscriptionStatus);
  // Onboarding v2 changes three things this shell owns: whether the chrome renders
  // at all (the `/setup` wizard is bare), whether the old onboarding chrome exists
  // (the classic sidebar's Onboarding entry and coach marks: not with v2), and
  // whether the Mingo-first shell loads the onboarding progress (only for v2: the
  // wizard redirect and the Getting Started tour read it). Gated: a wrong first
  // answer would draw the chrome around the wizard, then tear it down.
  const onboardingV2 = useFeatureFlagGate('onboarding-v2');
  // The wizard renders without the chrome - unless the workspace is locked, in
  // which case the lock screen takes `<main>` inside the usual (disabled) chrome.
  const bareChrome = onboardingV2 === 'on' && !showLockContent && isBareChromeRoute(pathname);
  // The landing pages (the dashboard, Mingo's home) wait for the same answer the
  // redirect acts on, so a session bound for `/setup` never sees a frame of it.
  // Bounded like the chrome's own wait: a progress request that never settles
  // releases the page, and the redirect still fires if the answer lands later.
  const setupPending = useSetupPending();
  const dashboardHeld = useFailOpen(
    holdsDashboard(pathname, onboardingV2, setupPending, showLockContent),
    CHROME_LOADING_FAIL_OPEN_MS,
  );
  // Every flag this shell's CHROME depends on, read reactively in one place:
  // the sidebar memo below and the header props both consume these, and a
  // `featureFlags.*` snapshot taken before the flags query answers would leave
  // them stuck on the env defaults with nothing to recompute them.
  // Plain booleans, so each reads `false` until the flags answer. `AppLayoutInner`
  // gates on the SESSION, not on flags, so this shell does render during that window
  // — what `chromeLoading` below covers is how it LOOKS, not whether it mounts.
  // Anything whose wrong value would redirect or change which surface renders needs
  // `useFeatureFlagGate` instead (see the drawer's URL sync).
  const insightsEnabled = useFeatureFlag('insights');
  const softwareManagementEnabled = useFeatureFlag('software-management');
  const tenantManagementEnabled = useFeatureFlag('tenant-management');
  const billingsEnabled = useFeatureFlag('billings');
  /**
   * What the app-wide billing banners have to say, reported by the hydrator
   * mounted below. `default`/`null` cover both "nothing set" and "nowhere near
   * it", which are the same thing to look at: nothing.
   */
  const [billingBars, setBillingBars] = useState<BillingBarsState>(NO_BARS);
  /**
   * The trial banner is the only dismissible one, and the dismissal is per
   * TRIAL (see `trial-bar-dismissal.ts`). Read past hydration, never in the
   * initializer: `localStorage` is empty on the server, so a state seeded from
   * it makes the two renders disagree about whether the band exists — a
   * mismatch that costs the whole shell subtree, exactly as the onboarding
   * cache beside it documents.
   */
  const trialToken = billingBars.trial?.token ?? null;
  const [trialDismissed, setTrialDismissed] = useState(false);
  useEffect(() => {
    setTrialDismissed(isTrialBarDismissed(trialToken));
  }, [trialToken]);
  /**
   * Both bars exist for their action — top up the balance, activate the
   * subscription — so they need a build that can do it: the mobile builds hide
   * every payment surface (App Store Guideline 3.1.1) and the desktop build
   * shows billing read-only — see `billing-visibility.ts`. Neither page these
   * bars would send you to has a top-up or a checkout on them.
   */
  const showBillingBars = billingsEnabled && !isBillingHidden() && !isBillingReadOnly() && sessionReady && !isLocked;

  // Mingo — the composer dock, the chat history, the Mingo rows — is meaningful only
  // inside the full, unlocked app shell (it hits authed endpoints), so the
  // subscription lock suppresses it.
  const chatEnabled = !isLocked;

  // The chat reads its content (empty state, identity, commands) the moment it
  // mounts. Before the session is in place those reads are refused, and each
  // refusal starts a token refresh that is refused too (a dev-ticket landing
  // mounts the shell before the ticket is exchanged).
  const chatMounted = mingoShell && chatEnabled && sessionReady;

  const [unreadCounts, setUnreadCounts] = useState<UnreadCountsByCategory>({});

  // Onboarding chrome: the sidebar "Onboarding" tab/badge. Progress comes from the
  // backend via the onboarding store, hydrated by `OnboardingProgressHydrator` below.
  // `onboardingLoaded` gates the chrome so nothing flickers before we know the real state.
  const tenantProgress = useOnboardingStore(state => state.tenant);
  const userProgress = useOnboardingStore(state => state.user);
  const onboardingLoaded = useOnboardingStore(state => state.isLoaded);

  // The nav's entries are flag-shaped, so until the answers arrive the chrome renders
  // its own loading state (core `loading` props below) instead of a partly-built or
  // guessed nav. That is also what covers the core header's first render: its
  // mobile/desktop split runs through `useMdUp() ?? false`, which reads "mobile"
  // until an effect has run.
  //
  // Onboarding progress counts as one of those answers: it decides whether the
  // "Onboarding" entry exists AT ALL, and that entry is PREPENDED (see
  // `getNavigationItems`), so learning about it late doesn't append a row — it inserts
  // one at the top and pushes every other item down. Both requests start together the
  // moment the session resolves (flags in `FeatureFlagsLoader`, progress in the
  // hydrator below), so waiting for both costs the difference between two parallel
  // round-trips, not a second one.
  //
  // `sessionReady` guards it because the hydrator only mounts once the session has
  // answered: without that, a signed-out render would wait on a request that is never
  // going to be made. Both stores resolve terminally for a signed-in user — the flags
  // loader marks them loaded on query error, and `fetchOnboardingProgress` does the
  // same on an error or a null payload.
  //
  // `isLocked` is excluded outright, and it is not an error case: a locked workspace
  // has its app requests HELD at the network layer (`subscription-gate.ts`), so the
  // onboarding progress request neither answers nor fails — it simply never settles,
  // and waiting on it left the sidebar and header skeletons up forever behind the lock
  // screen. There is no onboarding chrome to draw on a locked workspace anyway, which
  // is why the hydrator below is not mounted there either.
  //
  // Terminality is necessary but not sufficient, and this used to rely on it alone.
  // It only covers the way IN — "every load eventually answers" — and says nothing
  // about a store being emptied AFTER it answered, which is a reset away and is
  // precisely what pinned this to `true` for whole sessions (see
  // `onboarding-progress-hydrator.tsx`). `useFailOpen` bounds the wait regardless
  // of which of the two signals is stuck, or why.
  //
  // The Mingo-first shell has none of the old onboarding chrome (no Get Started entry,
  // no Initial Setup card), so it never waits for the progress. It loads it only for
  // onboarding v2: the `/setup` redirect and the Getting Started tour read it.
  const withOnboarding = !mingoShell;
  const loadsOnboardingProgress = withOnboarding || onboardingV2 === 'on';
  const flagsReady = useFeatureFlagsReady();
  const chromeIncomplete = !flagsReady || (withOnboarding && sessionReady && !isLocked && !onboardingLoaded);
  const chromeLoading = useFailOpen(chromeIncomplete, CHROME_LOADING_FAIL_OPEN_MS);

  const userDone = countCompleted(USER_ONBOARDING_STEPS, userProgress?.completedSteps ?? []);
  const userRemaining = USER_ONBOARDING_STEPS.length - userDone;
  // User "Get Started" is live until the user explicitly finishes or skips it.
  const userInProgress = !!userProgress && !userProgress.completed && !userProgress.skipped;
  // Tenant phase ends when an admin clicks the explicit "Complete Setup".
  const initialSetupComplete = tenantProgress?.completed ?? false;
  const showOnboardingChrome = onboardingLoaded;

  // The personal "Get Started" tour (sidebar tab + badge) only appears once the
  // tenant Initial Setup is complete — until then the user is kept on Initial Setup.
  // Onboarding v2 has no such entry: its tour lives in Mingo.
  const userOnboardingActive = showOnboardingChrome && initialSetupComplete && userInProgress && onboardingV2 === 'off';

  const navigationFlags = useMemo<NavigationFlags>(
    () => ({
      insights: insightsEnabled,
      softwareManagement: softwareManagementEnabled,
      tenantManagement: tenantManagementEnabled,
    }),
    [insightsEnabled, softwareManagementEnabled, tenantManagementEnabled],
  );

  const grouped = mingoShell;
  const navigationItems = useMemo(() => {
    const onboarding = userOnboardingActive ? { inProgress: true, remaining: userRemaining } : undefined;
    // Both from the one module table in `navigation-config.tsx`. The grouped entries
    // carry their own `match` rules: the core sidebar resolves the active one from
    // `currentPath`, so they do not depend on the location.
    return grouped
      ? getGroupedNavigationItems(navigationFlags, unreadCounts)
      : getNavigationItems(pathname, navigationFlags, unreadCounts, onboarding);
  }, [grouped, pathname, navigationFlags, unreadCounts, userOnboardingActive, userRemaining]);

  // The breakpoint in JS, for the decisions CSS cannot make in the Mingo-first shell:
  // which of two places MOUNTS the time tracker and the ticket alerts (the phone top bar
  // below md, the sidebar header from md) — both exist in the DOM at every width, and
  // the time tracker's popover follows a shared open state, so a second instance would
  // open a second panel — and whether ⌘K opens the phone drawer. `undefined` until the
  // query answers: neither mounts, they appear a frame late.
  const isMdUp = useMdUp();

  // Mingo-first only: the desktop collapse is the shell's (the classic sidebar keeps
  // its own persisted preference — the same one, under the same key).
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  // ⌘K's reveal command (`NavigationSidebarConfig.revealSignal`): every bump shows the
  // expanded sidebar at the current width — the tablet overlay too, which a change of
  // `collapsed` cannot open while the desktop preference is already "expanded".
  const [revealSignal, setRevealSignal] = useState(0);
  // Mingo-first only: the phone drawer is the shell's too (`AppLayout` `mobileMenuOpen`),
  // so ⌘K can open it and its slots can close it.
  const mobileMenuOpen = useMobileMenuStore(state => state.open);
  const setMobileMenuOpen = useMobileMenuStore(state => state.setOpen);
  const setHistorySearchOpen = useHistorySearchStore(state => state.setOpen);
  // ⌘K / Ctrl+K anywhere: the sidebar (or the phone drawer) opens on the chat-history
  // search. Not on a page that forwards the keyboard to a remote machine, and not
  // behind the paywall, where the history is not shown.
  useHistorySearchShortcut(mingoShell && chatEnabled && !bareChrome && !forwardsKeyboard(pathname), () => {
    // Desktop: expands a collapsed sidebar (through `onCollapsedChange`); tablet: opens
    // the overlay without touching the desktop preference.
    setRevealSignal(signal => signal + 1);
    // Below md the sidebar is the phone drawer; from md up the drawer is never drawn,
    // and an open state left there would show it on the way down.
    if (isMdUp === false) setMobileMenuOpen(true);
    setHistorySearchOpen(true);
  });
  const currentPath = search ? `${pathname}?${search}` : pathname;

  const sidebarConfig: NavigationSidebarConfig = useMemo(
    () =>
      grouped
        ? {
            variant: 'grouped',
            items: navigationItems,
            currentPath,
            loading: chromeLoading,
            loadingRows: NAVIGATION_LOADING_ROWS.grouped,
            // 264 (the brief), not Figma's 224: at 224 "Needs approval" + its count and
            // "Cloud tenants" + BETA truncate, and the chat titles get 40px more. The
            // pre-paint seed (`sidebarWidthFoucScript`) reads the app mode too, so the
            // first frame is already this wide.
            expandedWidth: GROUPED_SIDEBAR_EXPANDED_WIDTH,
            onNavigate: handleNavigate,
            // The Mingo rows (New chat, Needs approval) above the module tree, after
            // the desktop shell's update button as in the classic sidebar.
            topSlot: ({ minimized }) => (
              <>
                <SidebarUpdateButton minimized={minimized} />
                <MingoSidebarRows minimized={minimized} disabled={!chatEnabled} />
              </>
            ),
            // The chat history (stream B2), in the sidebar body's one scroll; in the
            // 56px rail a "Chats" row that opens the chat search. Drawn in the phone
            // drawer too — a second instance.
            // Behind the paywall Mingo is hidden altogether.
            sectionSlot: chatEnabled ? ({ minimized }) => <MingoSidebarHistorySlot minimized={minimized} /> : undefined,
            // The account row, and beside it the time tracker and the bell — the classic
            // header's right end — as compact buttons (stacked over the avatar in the rail;
            // unread support replies are in the account menu); the header is the logo alone. Below md the phone
            // top bar carries them. The phone drawer draws none: it stays mounted from md
            // up, and a second tracker over the shared open state closed the first.
            footerSlot: ({ minimized, inDrawer }) => (
              <div className="flex flex-col-reverse items-center gap-[var(--spacing-system-xxs)] @[140px]/of-nav-sidebar:flex-row">
                <div className="w-full min-w-0 @[140px]/of-nav-sidebar:flex-1">
                  <MingoAccountPopover collapsed={minimized} locked={showLockContent} />
                </div>
                {!inDrawer && <MingoSidebarControls ownsHeaderCells={isMdUp === true} disabled={showLockContent} />}
              </div>
            ),
            collapsed: sidebarCollapsed,
            onCollapsedChange: setSidebarCollapsed,
            revealSignal,
            className: 'h-full',
          }
        : {
            items: navigationItems,
            loading: chromeLoading,
            // The counts this app's nav settles on, so the placeholder is the same
            // height as the loaded rail (see `NAVIGATION_LOADING_ROWS`).
            loadingRows: NAVIGATION_LOADING_ROWS.flat,
            onNavigate: handleNavigate,
            // Desktop shell only: renders nothing until the shell reports an update
            // waiting. The slot is a render prop because the same node also draws in
            // the mobile burger menu, where there is no rail to collapse into.
            topSlot: ({ minimized }) => <SidebarUpdateButton minimized={minimized} />,
            // `h-full` (not `h-screen`) so the sidebar fills the layout row below the
            // optional top bar rather than overflowing the viewport by its height.
            className: 'h-full',
          },
    [
      grouped,
      navigationItems,
      currentPath,
      chromeLoading,
      handleNavigate,
      chatEnabled,
      sidebarCollapsed,
      setSidebarCollapsed,
      revealSignal,
      isMdUp,
      showLockContent,
    ],
  );

  // Single `topBar` slot, one bar at a time: the billing bars first, since they
  // ask for an action; otherwise the hub announcement — informational and
  // dismissible, so it only ever fills an empty slot (never stacks, never bumps
  // a bar out).
  let topBar: React.ReactNode;
  if (showLockContent) {
    // No band of any kind over the lock screen — whatever it would say, this
    // workspace cannot act on it: the AI and trial bars send you to Billing &
    // Usage. Answered first, so no later branch has to remember the lock.
    topBar = undefined;
  } else if (showBillingBars && billingBars.ai.tone !== 'default') {
    // First in line: agents about to stop answering cannot wait, and this
    // state is invisible from every page but Billing & Usage. The CTA lands
    // with the top-up dialog already open.
    topBar = (
      <AiBalanceBar
        tone={billingBars.ai.tone}
        onManage={() => router.push(routes.settings.billingUsage({ action: MANAGE_AI_BALANCE_ACTION }))}
      />
    );
  } else if (showBillingBars && billingBars.trial && !trialDismissed) {
    // Below the AI bars: a trial past its halfway point is a deadline, not a
    // failure.
    topBar = (
      <TrialEndingBar
        daysLeft={billingBars.trial.daysLeft}
        onActivate={() => router.push(routes.settings.billingUsage())}
        onDismiss={() => {
          if (!trialToken) return;
          dismissTrialBar(trialToken);
          setTrialDismissed(true);
        }}
      />
    );
  } else if (withOnboarding ? showOnboardingChrome : sessionReady && !isLocked) {
    // Loaded progress doubles as "a live, unlocked session": the hydrator behind
    // it only runs with one, and the announcement fetches on mount. The
    // Mingo-first shell loads no progress and asks the session directly.
    topBar = <AnnouncementTopBar />;
  }

  const displayName = useMemo(
    () => `${userFirstName || ''} ${userLastName || ''}`.trim(),
    [userFirstName, userLastName],
  );

  const avatarUrl = useMemo(() => getFullImageUrl(userImageUrl, userImageHash), [userImageUrl, userImageHash]);

  // The phone top bar's Mingo button, on every page: a phone has no composer under its
  // pages, so this is where Mingo is asked for. With Mingo closed it opens the chat list
  // over the page (the classic drawer's first screen: Start New Chat, My / All Chats, the
  // chats); with Mingo open (that list, a chat over the page, Mingo's home or a chat page)
  // it is the ×: back to the last page outside Mingo, the dashboard when there is none.
  // The chats themselves draw no close of their own on a phone.
  const mingoButton = mingoShell && chatEnabled && !dashboardHeld;
  const onMingoPage = ['home', 'chat'].includes(composerRouteOf(pathname));
  const sheetUp = useMingoSheetStore(state => isSheetUp(state, pathname));
  const listOpen = useMingoSheetStore(state => isListUp(state, pathname));
  const outsidePage = useMingoSheetStore(state => state.outsidePage);
  const showList = useMingoSheetStore(state => state.showList);
  const hideList = useMingoSheetStore(state => state.hideList);
  const hideSheet = useMingoSheetStore(state => state.hide);

  const headerProps = useMemo(
    () => ({
      // Placeholder cells until the flags answer — and, as a side effect, until the
      // core header's own `useMdUp()` has resolved, so its mobile-first render never
      // reaches the screen.
      loading: chromeLoading,
      // This is the ONLY header placeholder — the shell skeleton that used to
      // render one ahead of it is gone, so there is no second copy to stay in step
      // with. See `headerLoadingCells`.
      loadingActionCells: headerLoadingCells(),
      showNotifications: true,
      showTimeTracker: true,
      // No user cell in the header. Profile and Log Out stay reachable from the
      // Settings hub (its pinned "Log Out" button, an OSS tenant's) and, on mobile, from
      // the burger menu; the Mingo-first shell's account menu has both — which is why the
      // user props below are gone rather than kept unused: the core header only reads
      // them under `showUser`.
      showUser: false,
      // Support-ticket alerts cell — Help Center unread indication.
      // Attention-only: renders nothing unless <TicketLiveProvider> is
      // enabled (below), the viewer is authed, AND there are unread replies.
      showTicketAlerts: true,
      // The cell opens the newest unread ticket through the chat runtime's navigation
      // (`OpenframeChatRuntimeProvider`): a soft navigation, so the drawer opens on its row.
      ticketAlertsHref: routes.helpCenter.tickets,
      // The Mingo-first shell draws this header below md only (`desktopHeader`): the
      // phone top bar — burger, logo, time tracker, bell, ticket alerts and Mingo. Mingo
      // opens the chat list, and its × leaves Mingo (above); the burger's drawer has the
      // history too. (`showMingoAI` / `onMingoAI` / `isMingoAIActive` /
      // `mingoAICloseWhenActive` are core `AppHeader` prop names — external API, not ours.)
      ...(mingoShell && {
        loadingActionCells: mingoHeaderLoadingCells(mingoButton),
        showTimeTracker: isMdUp === false,
        showTicketAlerts: isMdUp === false,
        showMingoAI: mingoButton,
        onMingoAI: () => {
          if (listOpen) hideList();
          else if (sheetUp) hideSheet();
          else if (onMingoPage) router.push(outsidePage ?? routes.dashboard);
          else showList();
        },
        isMingoAIActive: listOpen || sheetUp || onMingoPage,
        mingoAICloseWhenActive: true,
      }),
    }),
    [
      chromeLoading,
      mingoShell,
      isMdUp,
      mingoButton,
      onMingoPage,
      sheetUp,
      listOpen,
      outsidePage,
      showList,
      hideList,
      hideSheet,
      router,
    ],
  );

  const mobileBurgerMenuProps = useMemo(
    () =>
      // The grouped drawer carries the account row in its footer slot instead
      // (`MingoAccountPopover`, with Log out in its menu).
      grouped
        ? {}
        : {
            user: {
              userName: displayName,
              userEmail,
              userAvatarUrl: avatarUrl || null,
              userRole,
            },
            onLogout: handleLogout,
          },
    [grouped, displayName, userEmail, avatarUrl, userRole, handleLogout],
  );

  // An OSS tenant has no slot; behind the paywall it is kept, empty. Held with the
  // landing page: the composer is part of what a session bound for the wizard must
  // not see first. Mingo's home is the exception: its greeting is up while held, centred
  // over the dock, so the dock holds its place in its loading form (`held`) rather than
  // arriving under the greeting and moving it.
  let composerDock: React.ReactNode;
  // Wrapped so the floating walkthrough card can rise above it (`COMPOSER_DOCK_ATTRIBUTE`
  // in walkthrough-video.tsx).
  if (mingoShell) {
    composerDock =
      chatEnabled && (!dashboardHeld || composerRouteOf(pathname) === 'home') ? (
        <div data-composer-dock="">
          <MingoComposerDock held={dashboardHeld} />
        </div>
      ) : null;
  }
  // The open chat over a page, raised from the dock: only with it.
  const composerSheet = mingoShell && chatEnabled && !dashboardHeld ? <MingoComposerSheet /> : undefined;

  // The page segment's boundary - what the chrome, bare or not, puts in its content
  // slot. Its placement rules are on the core layout below. Every page draws its own
  // loading state (its components in a loading scope, behind its own boundaries), so
  // this one only keeps a read that escapes a page from suspending the chrome around
  // it: it has no page of its own to draw.
  const pageContent = (
    <Suspense fallback={null /* loading-standard-ok(SUSPENSE_FALLBACK): a backstop under the pages' own boundaries */}>
      {showLockContent ? (
        <SubscriptionLockContent />
      ) : dashboardHeld ? (
        composerRouteOf(pathname) === 'home' ? (
          // A new chat: its greeting, nothing that loads.
          <MingoNewChat />
        ) : (
          <LoadingFallback label="Loading dashboard">
            <DashboardOverviews />
          </LoadingFallback>
        )
      ) : (
        children
      )}
    </Suspense>
  );

  return (
    <>
      {/* `!isLocked`: the badge count is decorative, and on a locked workspace its
          request is held by the subscription gate — the Suspense below would sit on
          its fallback for the whole visit rather than resolving. */}
      {sessionReady && !isLocked && (
        // Two boundaries, two different failures, both of them real here.
        //
        // ErrorBoundary: a trial-expired GraphQL error makes the query return null data,
        // which Relay surfaces as a thrown error. Unbounded it reaches Next's root and
        // shows the full-page "couldn't load" screen instead of degrading silently (the
        // subscription lock UI handles the messaging).
        //
        // Suspense: `UnreadCountsHydrator` runs `useLazyLoadQuery` (store-and-network) and
        // nothing else in the app fetches `unreadCountsByCategory`, so on a cold store it
        // genuinely suspends. This is the LAST app-owned boundary above it — the shell's
        // and the root layout's are gone as vestigial RSC-era wrappers — so without it the
        // wait for a decorative badge count is served by Next's root and holds the whole
        // app. `null` because there is nothing to draw: the count simply appears.
        <ErrorBoundary fallback={null}>
          <HydratorBoundary>
            <UnreadCountsHydrator onChange={setUnreadCounts} />
          </HydratorBoundary>
        </ErrorBoundary>
      )}
      {/* BOTH providers below are mounted UNCONDITIONALLY and told what to do
          through `enabled`. That is a rule, not a style: their answer
          (`sessionReady`) arrives mid-boot, and a wrapper that
          swaps between `<Provider>{children}</Provider>` and `<>{children}</>`
          changes the element TYPE at this position when they land — React then
          tears down and remounts EVERYTHING below, which here is the whole
          `CoreAppLayout` plus the page in it. It shipped that way: every cold
          load remounted the shell twice (queries refired, page state lost), and
          the visible tell was a chat drawer opened by a `?mingoDialog=` deep
          link replaying its open animation, because the drawer opens before the
          flags answer. Anything else that has to wrap this layout gets an
          `enabled` prop too — never a conditional mount.

          `enabled` itself: `sessionReady` (no request before `/me`
          answers), plus `!isLocked` — a locked workspace has its
          app data refused, so these requests would be parked by the
          subscription gate rather than answered (same reason as the onboarding
          hydrator below). With `enabled={false}` each provides NO context, so
          every surface reading it hides itself exactly as it did when the
          provider was absent. */}
      <TimeTrackerHostProvider enabled={sessionReady && !isLocked}>
        {/* Ticket live stream + unread indication (Help Center). Wraps
            CoreAppLayout so BOTH the header's TicketAlertsButton and the
            /help-center/tickets page (children) read one provider. */}
        <TicketLiveProvider enabled={sessionReady && !isLocked}>
          {/* The Mingo chat state, once for the session, around every surface that
              can show it (the dock, the sidebar history, the page). It runs only
              while one of them is mounted. */}
          <MingoChatProvider enabled={chatMounted} identityEnabled={chatIdentityEnabled}>
            {bareChrome ? (
              <BareAppShell>{pageContent}</BareAppShell>
            ) : (
              <CoreAppLayout
                // Hook for the native-shell safe-area CSS in globals.css: the layout
                // root owns the top inset (see `.app-shell-root`). Inert on the web.
                className="app-shell-root"
                mainClassName={mainClassName ?? APP_MAIN_CLASS_NAME}
                sidebarConfig={sidebarConfig}
                mobileBurgerMenuProps={mobileBurgerMenuProps}
                headerProps={headerProps}
                // The Mingo-first shell owns the phone drawer (see `useMobileMenuStore`); the
                // layout still reports every open and close, and closes it on a change of
                // `sidebarConfig.currentPath`. The OSS shell leaves it to the layout.
                mobileMenuOpen={grouped ? mobileMenuOpen : undefined}
                onMobileMenuOpenChange={grouped ? setMobileMenuOpen : undefined}
                // Greys the header and nav rail out for the lock: they stay legible —
                // the user can still see where they are and reach the account menu —
                // but nothing they lead to is reachable until the workspace is paid for.
                disabled={showLockContent}
                // The super user strip is not one of the bars above: it is a
                // statement about the session, not a notice, so it stacks over
                // whichever bar won the slot (or none), lock screen included.
                // Only once the session has answered, so a flag persisted from a
                // previous session cannot flash it ahead of `/me`.
                topBar={
                  <>
                    {sessionResolved && <SuperUserBanner />}
                    {topBar}
                  </>
                }
                // The Mingo-first shell: no desktop header (the phone top bar stays; the
                // bell and the time tracker move into the sidebar footer); the composer is
                // docked under every page — `null` behind the paywall, which keeps the slot
                // (and the page's layout) while drawing nothing.
                desktopHeader={!mingoShell}
                composerDock={composerDock}
                composerSheet={composerSheet}
                // Over the page's end on plain pages and home: the page runs on under it.
                composerDockFloats={mingoShell && dockViewOf(composerRouteOf(pathname)).floats}
                // A chat page: Mingo's background and glow from the top of the thread
                // to the bottom of the window, under the docked composer too.
                pageSurface={mingoShell && chatEnabled && composerRouteOf(pathname) === 'chat' ? 'mingo' : undefined}
              >
                {/* The page segment's boundary. Core used to own it (`loadingFallback`,
              dropped in 0.0.502 — `<main>` now renders `children` bare), so it
              lives here instead.

              It is not idle: the page segment arrives after the layout in the RSC
              stream, so it opens on EVERY route. Keeping it INSIDE `<main>` is the
              point — a page that suspends, or that bails to client rendering
              because it reads `useSearchParams()`, takes only the content area
              with it and the sidebar and header stay up. The app-wide boundary
              this replaces took the whole chrome.

              The fallback draws nothing on purpose: a neutral page shape here was
              a grey block flashed ahead of the real content whenever a browser
              frame landed in the gap. Pages own their real skeleton.

              One shell, two possible contents. The chrome around this never
              unmounts, so moving between them is a swap inside `<main>` and not
              a re-mount of the sidebar + header — which also means the lock
              arriving late costs a content swap, not a second chrome mount. */}
                {pageContent}
              </CoreAppLayout>
            )}
            {/* The chat history's search modal, once (the section is drawn twice). */}
            {grouped && chatEnabled && !bareChrome && <MingoHistorySearch />}
          </MingoChatProvider>
        </TicketLiveProvider>
      </TimeTrackerHostProvider>
      {/* Onboarding progress hydrator (fetches backend progress into the store)
          + coach-mark (shows only when a page was reached from an onboarding step
          via the `setupHint` query param). Gated on the session so the queries
          never fire before `/me` has answered, and on the lock because a locked
          workspace shows no onboarding — and its request would be held by the
          subscription gate rather than answered (see `chromeLoading`). */}
      {sessionReady && !isLocked && (
        <>
          {loadsOnboardingProgress && <OnboardingProgressHydrator />}
          {/* The coach mark is the old flow's; the wizard redirect is the new one's.
              Both read the progress the hydrator above loads. */}
          {withOnboarding && onboardingV2 === 'off' && <OnboardingCoachMark />}
          <OnboardingV2Redirect />
        </>
      )}
      {/* Reports what the billing banners above need. Suspends, so it sits in
          its own boundary and renders nothing either way — a shell that waited
          on it would hold the whole app for a banner. */}
      {showBillingBars && (
        <HydratorBoundary>
          <BillingBarsHydrator onResolved={setBillingBars} />
        </HydratorBoundary>
      )}
      {/* Desktop shell update offer. Also owns the mount-time availability
          check that the sidebar's update button reads. No-op elsewhere. */}
      <DesktopUpdateModal />
      {/* Floating walkthrough/demo video — the same widget every other Flamingo
          platform ships, mounted ONCE for the whole app next to the chat
          drawer. Which bottom corner it pins to is content-managed (the hub
          admin sets it per platform). Left out behind the subscription lock for
          the same reason the Mingo launcher is: that screen is not the app.
          After the session is in place, like the chat: its read is refused before.
          Not on the bare setup wizard either: it offers the clip from its own menu. */}
      {sessionReady && !isLocked && !bareChrome && <WalkthroughVideo />}
    </>
  );
}

function AppLayoutInner({ children, mainClassName }: { children: React.ReactNode; mainClassName?: string }) {
  const { isReady, isAuthenticated } = useAuthSession();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect unauthenticated users to auth page in OSS mode
  useEffect(() => {
    if (isReady && isOssTenantMode() && !isAuthenticated && !pathname?.startsWith('/auth')) {
      router.push('/auth');
    }
  }, [isReady, isAuthenticated, pathname, router]);

  // Auth-only mode (saas-shared): render children directly
  if (isAuthOnlyMode()) {
    return <>{children}</>;
  }

  // Resolved as signed out on a SaaS tenant: the overlay replaces the app.
  if (isReady && !isAuthenticated) {
    if (isSaasTenantMode()) {
      return <UnauthorizedOverlay />;
    }
    // OSS mode: the effect above is redirecting to /auth. Fall through so the
    // shell stays mounted with the page's own loading state in its content area
    // rather than swapping the whole chrome for a placeholder on the way out.
  }

  // The guard wraps EVERYTHING, and that placement is the rule, not a detail.
  // Anything mounted beside it instead of under it cannot read the subscription
  // answer, and a mutation is not held back by the network gate (see
  // `useSubscriptionOpen`) — which is how the presence heartbeat came to beat one
  // failing `recordPresence` every ten seconds behind the lock screen. Leaving no
  // "above the guard" position in this tree is what stops the next one.
  //
  // No `fallback` — the guard does not suspend, so the shell below mounts once
  // and stays mounted through the subscription round-trip.
  return (
    <SubscriptionGuard>
      {/* All three assume a signed-in user (push registration, biometric enrolment,
          presence is an authenticated mutation). The two that talk to the API also
          wait for the subscription answer, from inside — `useSubscriptionOpen`. */}
      {isReady && isAuthenticated && (
        <>
          <NativePushInitializer />
          <PresenceHeartbeat />
          <BiometricEnrollPrompt />
          <SessionHealthWatcher />
        </>
      )}
      {/* Logout confirmation modal — opened from the nav user menu, the Settings
          "Log Out" button (an OSS tenant's), and the lock screen's, all via `useLogoutConfirmStore`.
          Kept ABOVE the shell rather than inside it: all three callers are on the
          same side of the lock swap now, but a modal that outlives the content it
          was opened from is the safer place for it. */}
      <LogoutConfirmModal />
      <AppShell mainClassName={mainClassName}>{children}</AppShell>
    </SubscriptionGuard>
  );
}

export function AppLayout({ children, mainClassName }: { children: React.ReactNode; mainClassName?: string }) {
  return (
    // Nothing inside `AppLayoutInner` suspends on the normal boot path any more
    // (`TimeTrackerHostProvider` and every hydrator carry their own boundary, and
    // `SubscriptionGuard` no longer suspends), so this is a backstop rather than
    // a phase every page load goes through — which is why its fallback is empty.
    // A shell placeholder here drew a second, parallel copy of the chrome that had
    // to be kept in step with the real one and still disagreed with it for a frame.
    //
    // The boundary itself has to STAY, empty or not: the shell reads
    // `useSearchParams()`, which bails out to client rendering during the static
    // prerender, and Next requires a Suspense boundary to bail out to. Without one
    // `next build` fails on every statically generated page under `(app)` — and
    // only in a production build, so a dev-mode build won't tell you.
    <Suspense
      fallback={
        null /* loading-standard-ok(SUSPENSE_FALLBACK): the prerender bail-out boundary, never shown on the client */
      }
    >
      {/* The admin look for every tab strip; the lib's `default` is the hub's. */}
      <TabNavigationVariantProvider variant="admin">
        <AppLayoutInner mainClassName={mainClassName}>{children}</AppLayoutInner>
      </TabNavigationVariantProvider>
    </Suspense>
  );
}
