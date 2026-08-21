'use client';

import { useOptionalNotifications } from '@flamingo-stack/openframe-frontend-core';
import { ChatIdentityProvider } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  AppLayoutDrawer,
  AppLayoutDrawerContent,
  AppLayout as CoreAppLayout,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { TicketLiveProvider } from '@flamingo-stack/openframe-frontend-core/components/tickets';
import type { NavigationSidebarConfig } from '@flamingo-stack/openframe-frontend-core/types/navigation';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { useInitialSetupActive } from '@/app/(app)/onboarding/hooks/use-initial-setup-active';
import {
  countCompleted,
  TENANT_ONBOARDING_STEPS,
  USER_ONBOARDING_STEPS,
} from '@/app/(app)/onboarding/onboarding-steps';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useLogoutConfirmStore } from '@/app/(auth)/auth/stores/logout-confirm-store';
import { DesktopUpdateModal } from '@/app/components/desktop-update-modal';
import { LogoutConfirmModal } from '@/app/components/shared/logout-confirm-modal';
import { SidebarUpdateButton } from '@/app/components/sidebar-update-button';
import { useFeatureFlag, useFeatureFlagsReady } from '@/app/hooks/use-feature-flag';
import { getFullImageUrl } from '@/lib/image-url';
import { useNativeBackDismissible } from '@/lib/native-back';
import { writeCachedOnboardingTopBar } from '@/lib/onboarding-top-bar-cache';
import { isAppShell } from '@/lib/platform';
import { routes } from '@/lib/routes';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { isAuthOnlyMode, isOssTenantMode, isSaasTenantMode } from '../../lib/app-mode';
import { getNavigationItems, type NavigationFlags } from '../../lib/navigation-config';
import { APP_MAIN_CLASS_NAME, headerLoadingCells } from './app-shell-chrome';
import { BiometricEnrollPrompt } from './biometric-enroll-prompt';
import { ChatDrawerErrorBoundary } from './chat-drawer-error-boundary';
import { InitialSetupBar } from './initial-setup-bar';
import { NativePushInitializer } from './native-push-initializer';
import { type UnreadCountsByCategory, UnreadCountsHydrator } from './notifications/unread-counts-hydrator';
import { OnboardingCoachMark } from './onboarding-coach-mark';
import { OnboardingProgressHydrator } from './onboarding-progress-hydrator';
import { CachedOnboardingTopBar, useCachedOnboardingTopBar } from './onboarding-top-bar-cache';
import { OnboardingTourBar } from './onboarding-tour-bar';
import { OpenframeEmbeddableChatEntry } from './openframe-embeddable-chat-entry';
import { PresenceHeartbeat } from './presence-heartbeat';
import { SubscriptionGuard } from './subscription-lock/subscription-guard';
import { SubscriptionLockContent } from './subscription-lock/subscription-lock-content';
import { useSubscriptionLock } from './subscription-lock/subscription-lock-context';
import { TimeTrackerHostProvider } from './time-tracker-host-provider';
import { UnauthorizedOverlay } from './unauthorized-overlay';

/** Conditional `TicketLiveProvider` mount — a flag-off tenant gets a
 *  passthrough (no stream, no summary fetch, no context). */
function TicketLiveWhenEnabled({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return enabled ? <TicketLiveProvider>{children}</TicketLiveProvider> : <>{children}</>;
}

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

  useEffect(() => {
    if (!loading) {
      // Re-arm: a later load gets its own full window rather than inheriting a
      // previous timeout's verdict.
      setFailedOpen(false);
      return;
    }
    const timer = setTimeout(() => setFailedOpen(true), afterMs);
    return () => clearTimeout(timer);
  }, [loading, afterMs]);

  return loading && !failedOpen;
}

function AppShell({ children, mainClassName }: { children: React.ReactNode; mainClassName?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // The shell now mounts BEFORE the session resolves (see `AppLayoutInner`), so it
  // owns two things it used to get for free from being rendered only afterwards:
  // the user chrome fills in instead of being present from the start, and every
  // fetching child below is gated on this — a hydrator firing before `/me` has
  // answered would 401 into the refresh/force-logout path.
  const { isReady: sessionResolved, isAuthenticated } = useAuthSession();
  const sessionReady = sessionResolved && isAuthenticated;

  const userId = useAuthStore(state => state.user?.id);
  // Persisted alongside `user` in `auth-storage`, so on a reload it is what we
  // know about the session BEFORE `/me` answers — see `cacheOwnerId` below.
  const storeAuthenticated = useAuthStore(state => state.isAuthenticated);
  const userFirstName = useAuthStore(state => state.user?.firstName);
  const userLastName = useAuthStore(state => state.user?.lastName);
  const userEmail = useAuthStore(state => state.user?.email);
  const userRole = useAuthStore(state => state.user?.role);
  const userImageUrl = useAuthStore(state => state.user?.image?.imageUrl);
  const userImageHash = useAuthStore(state => state.user?.image?.hash);

  // Mingo chat open state — shared between the header trigger below and the
  // in-layout `AppLayoutDrawer` + `OpenframeEmbeddableChatEntry` in the
  // `drawer` slot. The chat runs shell-less inside the drawer, so the drawer
  // (not the chat) owns the panel chrome.
  //
  // Lifted into a global store (`mingo-launcher-store`) so pages can open the
  // drawer from anywhere — e.g. the onboarding "Meet Mingo" chips call
  // `sendToMingo(prompt)`, which flips `isOpen` here and queues a prompt the
  // chat embedder auto-sends on open.
  const chatOpen = useMingoLauncherStore(state => state.isOpen);
  const setChatOpen = useMingoLauncherStore(state => state.setOpen);
  const toggleChat = useMingoLauncherStore(state => state.toggle);

  // Defer chat-identity resolution until the drawer is FIRST opened — the
  // `ChatIdentityProvider` lives in the app shell (so it survives the drawer
  // remounting), which meant it hit `/content/api/auth/identity` on every page
  // even while the chat was closed. Latch on first open so identity still
  // resolves ONCE and survives close/reopen, but never fetches before the user
  // opens the chat at all.
  const [chatIdentityEnabled, setChatIdentityEnabled] = useState(false);
  useEffect(() => {
    // In the native shell, identity rides the `/content` proxy which
    // `embedAuthedFetch` refuses from the capacitor:// origin — a SYNCHRONOUS
    // throw inside the resolver effect that unmounts the whole shell. Leave
    // identity disabled there; the lib's designed fallback is anon identity.
    if (chatOpen && !isAppShell()) setChatIdentityEnabled(true);
  }, [chatOpen]);

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
  const closeChat = useCallback(() => setChatOpen(false), [setChatOpen]);
  useNativeBackDismissible(chatOpen, closeChat);
  useNativeBackDismissible(logoutOpen, closeLogout);

  // Notifications context (provided by NotificationsDataProvider in the root
  // layout). Read via ref so the pathname effect below doesn't depend on the
  // context value's render-to-render identity.
  const notificationsCtx = useOptionalNotifications();
  const closeNotificationsRef = useRef(notificationsCtx?.close);
  closeNotificationsRef.current = notificationsCtx?.close;

  // Close the in-layout panels (mingo chat + notifications drawer) on route
  // navigation. They are non-modal (header + sidebar stay interactive while
  // open), so clicking a nav link or an in-chat link that routes should land
  // the user on the new page rather than leaving a panel covering it. The lib
  // leaves this pathname-driven close to the embedder (it has no router), so
  // we own it here. Runs on `pathname` change; the initial no-op (already
  // closed) is harmless - React bails on a same-value `setState`.
  //
  // `pathname` is the intentional trigger but isn't read in the body (the
  // close actions are read imperatively via getState()/ref so they aren't
  // dependencies), so biome's exhaustive-deps rule sees it as "extra".
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the intentional re-run trigger; the close() actions are read imperatively
  useEffect(() => {
    useMingoLauncherStore.getState().close();
    closeNotificationsRef.current?.();
  }, [pathname]);

  const { isLocked, isResolved: subscriptionResolved } = useSubscriptionLock();
  // Checkout result pages render their own success/cancel UI; they're the only
  // place a paying user lands before the webhook flips the subscription to ACTIVE.
  const isCheckoutResultPage = pathname?.startsWith('/checkout') ?? false;
  const showLockContent = isLocked && !isCheckoutResultPage;
  // The subscription answer decides whether the page or the lock screen belongs
  // in `<main>`, so until it lands the page area holds the route's skeleton.
  // Checkout pages are exempt for the same reason they are exempt from the lock.
  // Note there is deliberately NO "still resolving" placeholder for the page
  // area. `children` render immediately — before the session and before the
  // subscription answer — and show their OWN loading state, because every app
  // data request waits on the session latch (`lib/session-ready.ts`) rather than
  // on this tree. That is what removed the route→skeleton registry: the mapping
  // from a page to its skeleton lives in the page, once.
  //
  // The trade-off is on the lock: a locked workspace sees its page's skeleton for
  // the length of the subscription round-trip before the lock screen swaps in.
  // The lock is UX, not enforcement (the API refuses the data either way), and
  // the query is `store-and-network`, so the window exists only on a cold store.
  void subscriptionResolved;
  void isCheckoutResultPage;
  // The Mingo sidebar (header launcher + in-layout chat drawer) is gated by the
  // `mingo-sidebar` feature flag. It's also only meaningful inside the full,
  // unlocked app shell (it hits authed endpoints), so the subscription lock
  // suppresses both the launcher and the drawer regardless of the flag.
  //
  // Suppressed on the legacy `/mingo` route: that page is itself a full Mingo
  // chat and shares the same global `mingo-messages-store`. Mounting the drawer
  // there too means two surfaces fight over `activeDialogId` — e.g. the page's
  // URL→store sync immediately re-selects the dialog the drawer's Back button
  // just cleared, so Back appears to do nothing. The drawer is the replacement
  // for that page, so they should never be live at the same time.
  const isMingoPage = pathname?.startsWith('/mingo') ?? false;
  // Every flag this shell's CHROME depends on, read reactively in one place:
  // the sidebar memo below and the header props both consume these, and a
  // `featureFlags.*` snapshot taken before the flags query answers would leave
  // them stuck on the env defaults with nothing to recompute them.
  // Plain booleans: `AppLayoutInner` holds its stub until the flags have answered,
  // so nothing below ever renders on an unanswered flag.
  const mingoSidebarEnabled = useFeatureFlag('mingo-sidebar');
  const timeTrackerEnabled = useFeatureFlag('time-tracker');
  const scriptsV2Enabled = useFeatureFlag('scripts-v2');
  const helpCenterEnabled = useFeatureFlag('help-center');
  const notificationsEnabled = useFeatureFlag('notifications');

  const chatEnabled = mingoSidebarEnabled && !showLockContent && !isMingoPage;
  const [unreadCounts, setUnreadCounts] = useState<UnreadCountsByCategory>({});

  // Onboarding chrome: the sidebar "Onboarding" tab/badge and the Initial Setup /
  // tour top bars. Progress comes from the backend via the onboarding store, hydrated
  // by `OnboardingProgressHydrator` below. `onboardingLoaded` gates the chrome so
  // nothing flickers before we know the real state.
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
  // That terminality is necessary but not sufficient, and this used to rely on it
  // alone. It only covers the way IN — "every load eventually answers" — and says
  // nothing about a store being emptied AFTER it answered, which is a reset away
  // and is precisely what pinned this to `true` for whole sessions (see
  // `onboarding-progress-hydrator.tsx`). `useFailOpen` bounds the wait regardless
  // of which of the two signals is stuck, or why.
  const flagsReady = useFeatureFlagsReady();
  const chromeIncomplete = !flagsReady || (sessionReady && !onboardingLoaded);
  const chromeLoading = useFailOpen(chromeIncomplete, CHROME_LOADING_FAIL_OPEN_MS);

  const tenantDone = countCompleted(TENANT_ONBOARDING_STEPS, tenantProgress?.completedSteps ?? []);
  const userDone = countCompleted(USER_ONBOARDING_STEPS, userProgress?.completedSteps ?? []);
  const userRemaining = USER_ONBOARDING_STEPS.length - userDone;
  // User "Get Started" is live until the user explicitly finishes or skips it.
  const userInProgress = !!userProgress && !userProgress.completed && !userProgress.skipped;
  // Tenant phase ends when an admin clicks the explicit "Complete Setup".
  const initialSetupComplete = tenantProgress?.completed ?? false;
  // Shared predicate for the tenant Initial Setup surfaces — the SAME one that gates the
  // dashboard card + dimming, so the yellow bar can never show without the card. Requires a
  // real (non-null) tenant record, unlike `!initialSetupComplete` which treated a failed/empty
  // progress fetch (tenant === null) as "incomplete" and lit the bar with no card behind it.
  const initialSetupActive = useInitialSetupActive();
  const showOnboardingChrome = onboardingLoaded;

  // The personal "Get Started" tour (sidebar tab + badge) only appears once the
  // tenant Initial Setup is complete — until then the user is kept on Initial Setup.
  const userOnboardingActive = showOnboardingChrome && initialSetupComplete && userInProgress;

  const navigationFlags = useMemo<NavigationFlags>(
    () => ({
      scriptsV2: scriptsV2Enabled,
      mingoSidebar: mingoSidebarEnabled,
      timeTracker: timeTrackerEnabled,
      helpCenter: helpCenterEnabled,
    }),
    [scriptsV2Enabled, mingoSidebarEnabled, timeTrackerEnabled, helpCenterEnabled],
  );

  const navigationItems = useMemo(
    () =>
      getNavigationItems(
        pathname,
        navigationFlags,
        unreadCounts,
        userOnboardingActive ? { inProgress: true, remaining: userRemaining } : undefined,
      ),
    [pathname, navigationFlags, unreadCounts, userOnboardingActive, userRemaining],
  );

  const sidebarConfig: NavigationSidebarConfig = useMemo(
    () => ({
      items: navigationItems,
      loading: chromeLoading,
      // The counts this app's nav settles on, so the placeholder is the same height
      // as the loaded rail: 7 primary (Dashboard, Customers, Devices, Scripts,
      // Monitoring, Logs, Tickets) and 2 secondary (Knowledge Base, Settings).
      loadingRows: { primary: 7, secondary: 2 },
      onNavigate: handleNavigate,
      // Desktop shell only: renders nothing until the shell reports an update
      // waiting. The slot is a render prop because the same node also draws in
      // the mobile burger menu, where there is no rail to collapse into.
      topSlot: ({ minimized }) => <SidebarUpdateButton minimized={minimized} />,
      // `h-full` (not `h-screen`) so the sidebar fills the layout row below the
      // optional top bar rather than overflowing the viewport by its height.
      className: 'h-full',
    }),
    [navigationItems, chromeLoading, handleNavigate],
  );

  // Onboarding top bar (single `topBar` slot, one bar at a time):
  //   Tenant phase (Initial Setup incomplete): the yellow `InitialSetupBar` on
  //     EVERY page — on the dashboard (which hosts the setup card) the CTA is
  //     dropped, everywhere else it links back to the card.
  //   User phase (Initial Setup done, Get Started still in progress): the
  //     `OnboardingTourBar` on EVERY page — on `/onboarding` the CTA is dropped.
  // Each bar's CTA reads "Start …"/"Take …" until its first step is done, then
  // "Continue …". Driven by the backend onboarding progress in the store.
  const isOnboardingPage = pathname?.startsWith('/onboarding') ?? false;
  const isDashboardPage = pathname === '/' || (pathname?.startsWith('/dashboard') ?? false);
  // Who the cached band is allowed to speak for. The replay below is the ONLY
  // branch a signed-out shell can reach — `showOnboardingChrome` needs the
  // hydrator, which needs a session — so without an owner it held the previous
  // session's banner over the skeleton indefinitely, CTA and all.
  //
  // Before `/me` answers we go on the PERSISTED auth store: a user who signed
  // out left it false, so a reload after logout reserves nothing, while an
  // ordinary signed-in reload still gets the band reserved ahead of the session
  // round-trip — which is the layout shift the cache exists to prevent. Once the
  // session has answered, its verdict wins in both directions.
  const cacheOwnerId = (sessionResolved ? isAuthenticated : storeAuthenticated) ? (userId ?? null) : null;
  // Read per owner, and past hydration, since the cache behind it is
  // browser-only (see `useCachedOnboardingTopBar`).
  const cachedTopBar = useCachedOnboardingTopBar(cacheOwnerId);
  let topBar: React.ReactNode;
  if (showOnboardingChrome) {
    if (initialSetupActive) {
      topBar = (
        <InitialSetupBar
          onStart={() => router.push(routes.dashboard)}
          started={tenantDone > 0}
          showAction={!isDashboardPage}
        />
      );
    } else if (initialSetupComplete && userInProgress) {
      topBar = (
        <OnboardingTourBar
          onStart={() => router.push(routes.onboarding)}
          started={userDone > 0}
          showAction={!isOnboardingPage}
        />
      );
    }
  } else {
    // Progress hasn't loaded yet. Rendering nothing here just moves the jump
    // from the skeleton to this side of the handoff — the shell reserves the
    // band, then the live layout drops it and the app snaps up until the query
    // lands. Replay the same cached decision until we know better.
    topBar = (
      <CachedOnboardingTopBar
        cached={cachedTopBar}
        pathname={pathname}
        onStart={() => router.push(cachedTopBar?.kind === 'tour' ? routes.onboarding : routes.dashboard)}
      />
    );
  }

  // Remember which banner (if any) this slot resolved to, so the next cold start can
  // replay the same decision instead of letting the bar drop in late and push the whole
  // app down. Only once progress has actually loaded — before that `topBar` is
  // undefined because we don't know yet, which is not the same answer as "no bar".
  //
  // Stamped with the user it was computed for: the entry outlives the session, and
  // an unattributed one is replayable by whoever opens the tab next.
  useEffect(() => {
    if (!onboardingLoaded || !userId) return;
    if (initialSetupActive) {
      writeCachedOnboardingTopBar({ kind: 'initial-setup', started: tenantDone > 0, userId });
    } else if (initialSetupComplete && userInProgress) {
      writeCachedOnboardingTopBar({ kind: 'tour', started: userDone > 0, userId });
    } else {
      writeCachedOnboardingTopBar({ kind: 'none', started: false, userId });
    }
  }, [onboardingLoaded, initialSetupActive, initialSetupComplete, userInProgress, tenantDone, userDone, userId]);

  const displayName = useMemo(
    () => `${userFirstName || ''} ${userLastName || ''}`.trim(),
    [userFirstName, userLastName],
  );

  // Receives the FULL href computed by TicketAlertsButton
  // (`/help-center/tickets?ticket=<id>#ticket-<id>` for the newest-unread
  // ticket) — soft-navigate so the drawer auto-opens + the row scrolls.
  const openHelpCenterTickets = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

  const avatarUrl = useMemo(() => getFullImageUrl(userImageUrl, userImageHash), [userImageUrl, userImageHash]);

  const headerProps = useMemo(
    () => ({
      // Placeholder cells until the flags answer — and, as a side effect, until the
      // core header's own `useMdUp()` has resolved, so its mobile-first render never
      // reaches the screen.
      loading: chromeLoading,
      // MUST be passed explicitly: `showNotifications`/`showTimeTracker`/`showMingoAI`
      // below are themselves flag-driven, so during `loading` they all read false and
      // the placeholder would reserve nothing at all.
      //
      // This is now the ONLY header placeholder — the shell skeleton that used to
      // render one ahead of it is gone, so there is no second copy to stay in step
      // with. A tenant with one of the flags off loses a cell from a right-aligned
      // cluster in empty space, which shifts nothing else on the page — see
      // `headerLoadingCells`.
      loadingActionCells: headerLoadingCells(),
      showNotifications: notificationsEnabled,
      showTimeTracker: timeTrackerEnabled,
      // No user cell in the header. Profile and Log Out stay reachable from the
      // Settings hub (its pinned "Log Out" button) and, on mobile, from the burger
      // menu — which is why the user props below are gone rather than kept unused:
      // the core header only reads them under `showUser`.
      showUser: false,
      // These three are core `AppHeader` prop names (the "AI" digraph trips
      // biome's strictCase camelCase rule); they're external API, not ours.
      // Support-ticket alerts cell — Help Center unread indication.
      // Attention-only: renders nothing unless <TicketLiveProvider> is
      // mounted (same helpCenterEnabled gate below), the viewer is
      // authed, AND there are unread replies.
      showTicketAlerts: helpCenterEnabled,
      ticketAlertsHref: routes.helpCenter.tickets,
      onTicketAlerts: openHelpCenterTickets,
      // biome-ignore lint/style/useNamingConvention: external lib prop name
      showMingoAI: chatEnabled,
      // biome-ignore lint/style/useNamingConvention: external lib prop name
      onMingoAI: toggleChat,
      // biome-ignore lint/style/useNamingConvention: external lib prop name
      isMingoAIActive: chatOpen,
    }),
    [
      chromeLoading,
      notificationsEnabled,
      timeTrackerEnabled,
      chatEnabled,
      toggleChat,
      chatOpen,
      helpCenterEnabled,
      openHelpCenterTickets,
    ],
  );

  const mobileBurgerMenuProps = useMemo(
    () => ({
      user: {
        userName: displayName,
        userEmail,
        userAvatarUrl: avatarUrl || null,
        userRole,
      },
      onLogout: handleLogout,
    }),
    [displayName, userEmail, avatarUrl, userRole, handleLogout],
  );

  const chatDrawer = chatEnabled ? (
    // ChatIdentityProvider wraps the drawer (not the remounting panel content)
    // so chat identity resolves ONCE for the session and survives the drawer
    // closing/reopening. Without it, EmbeddableChat self-fetches identity on
    // every open (the panel unmounts on close). Must sit inside the chat
    // runtime context (provided higher up by OpenframeChatRuntimeProvider).
    <ChatIdentityProvider enabled={chatIdentityEnabled}>
      <AppLayoutDrawer open={chatOpen} onOpenChange={setChatOpen}>
        <AppLayoutDrawerContent
          side="right"
          flush
          resizable
          minSize={480}
          // Default ~920px so every user opens the Mingo panel in its
          // two-column "Current Chats" split (320px history rail + ~600px chat
          // block, both well above their minimums); narrower resizes fall back
          // to the stacked single-column layout. `storageKey` is versioned so
          // this new default reaches users who had the old width persisted.
          defaultSize={920}
          storageKey="openframe:mingo-chat-width-v2"
          panelClassName="!bg-ods-bg"
        >
          {/* No AppLayoutDrawerHeader/Title — EmbeddableChat renders its own
              header + X button; a wrapper header would double it up. */}
          <ChatDrawerErrorBoundary>
            <OpenframeEmbeddableChatEntry open={chatOpen} onOpenChange={setChatOpen} />
          </ChatDrawerErrorBoundary>
        </AppLayoutDrawerContent>
      </AppLayoutDrawer>
    </ChatIdentityProvider>
  ) : null;

  return (
    <>
      {notificationsEnabled && sessionReady && (
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
          <Suspense fallback={null}>
            <UnreadCountsHydrator onChange={setUnreadCounts} />
          </Suspense>
        </ErrorBoundary>
      )}
      <TimeTrackerHostProvider enabled={timeTrackerEnabled && sessionReady}>
        {/* Ticket live stream + unread indication (Help Center). Gated on the
            same feature flag as the surface it serves; wraps CoreAppLayout so
            BOTH the header's TicketAlertsButton and the /help-center/tickets
            page (children) read one provider. Without it every ticket-live
            surface renders nothing and no stream/summary request fires. */}
        <TicketLiveWhenEnabled enabled={helpCenterEnabled && sessionReady}>
          <CoreAppLayout
            // Hook for the native-shell safe-area CSS in globals.css: the layout
            // root owns the top inset (see `.app-shell-root`). Inert on the web.
            className="app-shell-root"
            mainClassName={mainClassName ?? APP_MAIN_CLASS_NAME}
            sidebarConfig={sidebarConfig}
            mobileBurgerMenuProps={mobileBurgerMenuProps}
            headerProps={headerProps}
            disabled={showLockContent}
            drawer={chatDrawer}
            topBar={topBar}
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
              a re-mount of the sidebar + header. */}
            <Suspense fallback={null}>{showLockContent ? <SubscriptionLockContent /> : children}</Suspense>
          </CoreAppLayout>
        </TicketLiveWhenEnabled>
      </TimeTrackerHostProvider>
      {/* Onboarding progress hydrator (fetches backend progress into the store)
          + coach-mark (shows only when a page was reached from an onboarding step
          via the `setupHint` query param). Gated on the session so the queries
          never fire before `/me` has answered. */}
      {sessionReady && (
        <>
          <OnboardingProgressHydrator />
          <OnboardingCoachMark />
        </>
      )}
      {/* Logout confirmation modal — opened from the nav user menu and the
          Settings "Log Out" button via `useLogoutConfirmStore`. */}
      <LogoutConfirmModal />
      {/* Desktop shell update offer. Also owns the mount-time availability
          check that the sidebar's update button reads. No-op elsewhere. */}
      <DesktopUpdateModal />
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

  return (
    <>
      {/* All three assume a signed-in user (push registration, biometric enrolment,
          presence is an authenticated mutation). */}
      {isReady && isAuthenticated && (
        <>
          <NativePushInitializer />
          <PresenceHeartbeat />
          <BiometricEnrollPrompt />
        </>
      )}
      {/* No `fallback` — the guard no longer suspends, so the shell below mounts
          once and stays mounted through the subscription round-trip. */}
      <SubscriptionGuard>
        <AppShell mainClassName={mainClassName}>{children}</AppShell>
      </SubscriptionGuard>
    </>
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
    <Suspense fallback={null}>
      <AppLayoutInner mainClassName={mainClassName}>{children}</AppLayoutInner>
    </Suspense>
  );
}
