'use client';

import { useOptionalNotifications } from '@flamingo-stack/openframe-frontend-core';
import {
  ChatIdentityProvider,
  MINGO_V2_RAIL_WIDTH,
  MINGO_V2_SPLIT_WIDTH,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ChatsIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  AppLayoutDrawer,
  AppLayoutDrawerContent,
  AppLayout as CoreAppLayout,
  SIDE_PANEL_FRAME_WIDTH,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
import type { AppLayoutSidePanelConfig } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { TicketLiveProvider } from '@flamingo-stack/openframe-frontend-core/components/tickets';
import { TabNavigationVariantProvider } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { NavigationSidebarConfig } from '@flamingo-stack/openframe-frontend-core/types/navigation';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMingoDialogUrlSync } from '@/app/(app)/mingo/hooks/use-mingo-dialog-url-sync';
import { MingoChatProvider } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { countCompleted, USER_ONBOARDING_STEPS } from '@/app/(app)/onboarding/onboarding-steps';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useLogoutConfirmStore } from '@/app/(auth)/auth/stores/logout-confirm-store';
import { DesktopUpdateModal } from '@/app/components/desktop-update-modal';
import { LogoutConfirmModal } from '@/app/components/shared/logout-confirm-modal';
import { SidebarUpdateButton } from '@/app/components/sidebar-update-button';
import { useFeatureFlag, useFeatureFlagsReady } from '@/app/hooks/use-feature-flag';
import { useMingoV2ChatGate, useShellVariant } from '@/app/hooks/use-shell-variant';
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
import { AnnouncementTopBar } from './announcement-top-bar';
import { APP_MAIN_CLASS_NAME, headerLoadingCells, mingoHeaderLoadingCells } from './app-shell-chrome';
import { AiBalanceBar, BillingBarsHydrator, type BillingBarsState, NO_BARS, TrialEndingBar } from './billing-bars';
import { BiometricEnrollPrompt } from './biometric-enroll-prompt';
import { ChatDrawerErrorBoundary } from './chat-drawer-error-boundary';
import { useHistorySearchStore } from './mingo-shell/history-search-store';
import { MingoAccountPopover } from './mingo-shell/mingo-account-popover';
import { MingoComposerDock } from './mingo-shell/mingo-composer-dock';
import { composerRouteOf } from './mingo-shell/mingo-dock-route';
import { MingoSidebarControls } from './mingo-shell/mingo-sidebar-controls';
import { MingoHistorySearch, MingoSidebarHistorySlot } from './mingo-shell/mingo-sidebar-history';
import { MingoSidebarRows } from './mingo-shell/mingo-sidebar-rows';
import { useMobileMenuStore } from './mingo-shell/mobile-menu-store';
import { resolveShellSlots } from './mingo-shell/shell-slots';
import { forwardsKeyboard, useHistorySearchShortcut } from './mingo-shell/use-history-search-shortcut';
import { useSidebarCollapsed } from './mingo-shell/use-sidebar-collapsed';
import { isFullWidthPage, MingoSidePanel } from './mingo-side-panel';
import { NativePushInitializer } from './native-push-initializer';
import { type UnreadCountsByCategory, UnreadCountsHydrator } from './notifications/unread-counts-hydrator';
import { OnboardingCoachMark } from './onboarding-coach-mark';
import { OnboardingProgressHydrator } from './onboarding-progress-hydrator';
import { OpenframeEmbeddableChatEntry } from './openframe-embeddable-chat-entry';
import { PresenceHeartbeat } from './presence-heartbeat';
import { SubscriptionGuard, useSubscriptionLock } from './subscription-lock/subscription-guard';
import { SubscriptionLockContent } from './subscription-lock/subscription-lock-content';
import { isRouteOpenWhileLocked } from './subscription-lock/subscription-status';
import { TimeTrackerHostProvider } from './time-tracker-host-provider';
import { UnauthorizedOverlay } from './unauthorized-overlay';
import { WalkthroughVideo } from './walkthrough-video';

/**
 * Layer the Mingo drawer OVER the floating walkthrough video card.
 *
 * The card is a viewport-`fixed` `z-[9980]` element the lib owns. The drawer is
 * `absolute` inside AppLayout's main-area container, which is `relative` with
 * NO z-index and so starts no stacking context — the two therefore compare
 * directly in the root context, and the drawer's default `z-[103]` lost. The
 * promo card sat on top of the chat, over its message input included.
 *
 * The raise MUST go on the drawer's `Content` node, which is what carries that
 * `z-[103]` and hence OWNS the stacking context. `panelClassName` lands on a
 * div INSIDE it, where any z-index is scoped to that context and can never
 * out-rank the card — and raising the overlay alone then puts the scrim above
 * the panel and dims the chat itself.
 *
 * `Content` exposes no className seam, but it does forward `style`, so the
 * z-index goes there. The overlay stays just under the panel and above the
 * card, so the card dims with the rest of the page instead of staying lit over
 * the scrim. 9990 is the tier the lib's own comment reserves for a chat dock;
 * both stay below toasts (`z-[9999]`).
 *
 * NOTE: this covers the drawer this app mounts. The lib's `NotificationDrawer`
 * renders inside `AppLayout` with no seam at all, so it keeps its own layer.
 */
const WALKTHROUGH_OVERLAP_Z = {
  content: { zIndex: 9990 },
  overlay: '!z-[9985]',
} as const;

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
 * The classic shell's `?mingoDialog=` owner, as a component so it mounts in that shell
 * only. It mirrors the drawer's open conversation into the URL and adopts one from it —
 * what makes a dialog shareable by link and reachable from a push/OS-notification deep
 * link — and owns the drawer's close-on-navigate. `canOpenDrawer` makes it HOLD an
 * instruction rather than apply it into a shell that renders no drawer.
 *
 * Not in the Mingo-first shell, which has no drawer: there `MingoDialogParamBridge`
 * forwards the param to the chat page, and two owners of one param race. Not while the
 * variant is `'loading'` either: the param waits for whichever owner the answer picks.
 */
function ClassicMingoDialogUrlSync({ canOpenDrawer }: { canOpenDrawer: boolean }) {
  useMingoDialogUrlSync(canOpenDrawer);
  return null;
}

function AppShell({ children, mainClassName }: { children: React.ReactNode; mainClassName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // Which shell this is — the ONE read of `mingo-first` (A0's `useShellVariant`: the
  // flag, the per-user "Classic layout" opt-out and the dev override). Every slot below
  // is chosen from it through `resolveShellSlots`; the layout element itself never
  // changes with it.
  const variant = useShellVariant();

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
  // Mingo v2 docks the chat into the layout, so it is on screen from the first
  // paint: nothing to defer the identity to — and the Mingo-first shell implies the
  // v2 chat (its composer is docked under every page). In the classic shell this IS
  // `mingo-v2`, which also picks drawer vs side panel below. Gated (not a plain
  // boolean): which chat surface renders hangs on it, and a wrong first answer would
  // mount the overlay drawer and then swap it out.
  const v2ChatGate = useMingoV2ChatGate();
  // Latched during render, not in an effect: the provider below reads this flag,
  // so an effect would render the drawer's first frame with identity still off
  // and start the fetch one paint later than the user opened it.
  //
  // In the native shell, identity rides the `/content` proxy which
  // `embedAuthedFetch` refuses from the capacitor:// origin — a SYNCHRONOUS
  // throw inside the resolver effect that unmounts the whole shell. Leave
  // identity disabled there; the lib's designed fallback is anon identity.
  if ((chatOpen || v2ChatGate === 'on') && !chatIdentityEnabled && !isAppShell()) {
    setChatIdentityEnabled(true);
  }

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
  // Not in the Mingo-first shell: it has no drawer for the launcher's `isOpen` to
  // show, so back must not be spent closing one.
  useNativeBackDismissible(chatOpen && variant !== 'mingo', closeChat);
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
  // The Mingo chat drawer used to be closed here too; it now belongs to
  // `useMingoDialogUrlSync` (`ClassicMingoDialogUrlSync`) — why it can't be its own
  // effect is on the resolver's step 1.
  //
  // The Mingo-first shell counts a query change as a navigation too: its chat pages
  // differ only by `?id=`, and moving to another chat from the sidebar history must
  // not leave the drawer over it. (That shell's phone drawer closes on the same
  // trigger inside the layout, which watches `sidebarConfig.currentPath`.)
  //
  // `locationKey` is the intentional trigger but isn't read in the body — the
  // close action is read imperatively, so it isn't a dependency of it.
  const locationKey = variant === 'mingo' ? `${pathname}?${search}` : pathname;
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

  // The Mingo sidebar (header launcher + in-layout chat drawer) is the only chat
  // surface there is. It is meaningful only inside the full, unlocked app shell
  // (it hits authed endpoints), so the subscription lock suppresses both the
  // launcher and the drawer.
  const chatEnabled = !isLocked;

  // The chat reads its content (empty state, identity, commands) the moment it
  // mounts. Before the session is in place those reads are refused, and each
  // refusal starts a token refresh that is refused too (a dev-ticket landing
  // mounts the shell before the ticket is exchanged).
  const chatMounted = chatEnabled && sessionReady;

  // Every slot of the one `CoreAppLayout` below, per shell variant — see
  // `mingo-shell/shell-slots.ts` for the matrix (and its test).
  const slots = resolveShellSlots({ variant, v2ChatGate, chatMounted, locked: isLocked });

  // Same answer, published for the non-React callers that need it — notification
  // clicks decide drawer-vs-navigate through `openMingoDialog` (the dialog-open
  // seam), which has no hooks and cannot see the subscription lock. Published in
  // every variant: Fix with Mingo and the seam read it as "chat available".
  const setChatCanOpen = useMingoLauncherStore(state => state.setCanOpen);
  useEffect(() => {
    setChatCanOpen(chatEnabled);
    // Unpublish with the shell that owns it. `forceLogout` on a SaaS tenant returns
    // without a reload, so this shell unmounts while the root-layout notifications
    // provider keeps running — and a desktop toast raised moments earlier still holds
    // a live `onclick`. Without this, that click reads a latched `true` and opens into
    // a drawer that no longer exists. Cleanup and re-run share an effect phase, so a
    // `chatEnabled` change has no observable false→true window.
    return () => setChatCanOpen(false);
  }, [chatEnabled, setChatCanOpen]);
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
  // The Mingo-first shell has no onboarding (no Get Started tour, no Initial Setup),
  // so it neither waits for the progress nor loads it. The flags decide the variant,
  // so `'loading'` keeps the classic shell's parallel start.
  const withOnboarding = variant !== 'mingo';
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
  const userOnboardingActive = showOnboardingChrome && initialSetupComplete && userInProgress;

  const navigationFlags = useMemo<NavigationFlags>(
    () => ({
      insights: insightsEnabled,
      softwareManagement: softwareManagementEnabled,
      tenantManagement: tenantManagementEnabled,
    }),
    [insightsEnabled, softwareManagementEnabled, tenantManagementEnabled],
  );

  const grouped = slots.sidebar === 'grouped';
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
  // so the top bar's Chat history cell and ⌘K can open it and its slots can close it.
  const mobileMenuOpen = useMobileMenuStore(state => state.open);
  const setMobileMenuOpen = useMobileMenuStore(state => state.setOpen);
  const setHistorySearchOpen = useHistorySearchStore(state => state.setOpen);
  // ⌘K / Ctrl+K anywhere: the sidebar (or the phone drawer) opens on the chat-history
  // search. Not on a page that forwards the keyboard to a remote machine, and not
  // behind the paywall, where the history is not shown.
  useHistorySearchShortcut(slots.historySearchShortcut && chatEnabled && !forwardsKeyboard(pathname), () => {
    // Desktop: expands a collapsed sidebar (through `onCollapsedChange`); tablet: opens
    // the overlay without touching the desktop preference.
    setRevealSignal(signal => signal + 1);
    // Below md the sidebar is the phone drawer; from md up the drawer is never drawn,
    // and an open state left there would show it on the way down.
    if (isMdUp === false) setMobileMenuOpen(true);
    setHistorySearchOpen(true);
  });
  const currentPath = search ? `${pathname}?${search}` : pathname;

  // Receives the FULL href computed by TicketAlertsButton
  // (`/help-center/tickets?ticket=<id>#ticket-<id>` for the newest-unread
  // ticket) — soft-navigate so the drawer auto-opens + the row scrolls.
  const openHelpCenterTickets = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

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
            // pre-paint seed stays 224 (the shell is unknown before the flags answer),
            // so this sidebar snaps to 264 once, without animating.
            expandedWidth: 264,
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
            // The account row, and beside it the time tracker, the bell and the ticket
            // alerts — the classic header's right end — as compact buttons (stacked over
            // the avatar in the rail); the header is the logo alone. Below md the phone
            // top bar carries them. The phone drawer draws none: it stays mounted from md
            // up, and a second tracker over the shared open state closed the first.
            footerSlot: ({ minimized, inDrawer }) => (
              <div className="flex flex-col-reverse items-center gap-[var(--spacing-system-xxs)] @[140px]/of-nav-sidebar:flex-row">
                <div className="w-full min-w-0 @[140px]/of-nav-sidebar:flex-1">
                  <MingoAccountPopover collapsed={minimized} locked={isLocked} />
                </div>
                {slots.sidebarControls && !inDrawer && (
                  <MingoSidebarControls
                    ownsHeaderCells={isMdUp === true}
                    disabled={showLockContent}
                    onTicketAlerts={openHelpCenterTickets}
                  />
                )}
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
            // height as the loaded rail (see `NAVIGATION_LOADING_ROWS`). The
            // `'loading'` variant draws these too: the shape most tenants settle on.
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
      isLocked,
      sidebarCollapsed,
      setSidebarCollapsed,
      revealSignal,
      slots.sidebarControls,
      isMdUp,
      showLockContent,
      openHelpCenterTickets,
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
      // Settings hub (its pinned "Log Out" button) and, on mobile, from the burger
      // menu — which is why the user props below are gone rather than kept unused:
      // the core header only reads them under `showUser`.
      showUser: false,
      // `showMingoAI` / `onMingoAI` / `isMingoAIActive` below are core
      // `AppHeader` prop names — external API, not ours.
      // Support-ticket alerts cell — Help Center unread indication.
      // Attention-only: renders nothing unless <TicketLiveProvider> is
      // enabled (below), the viewer is authed, AND there are unread replies.
      showTicketAlerts: true,
      ticketAlertsHref: routes.helpCenter.tickets,
      onTicketAlerts: openHelpCenterTickets,
      showMingoAI: chatEnabled,
      onMingoAI: toggleChat,
      isMingoAIActive: chatOpen,
      // The Mingo-first shell draws this header below md only (`desktopHeader`): the
      // phone top bar — burger, logo, Chat history, time tracker, bell, ticket alerts,
      // Mingo. Chat history opens the drawer, where the history section lives (the
      // active chats, not only the archive); Mingo goes home — there is no drawer to
      // toggle, and an "active" Mingo cell would turn into a close ×.
      ...(slots.mobileMingoCells && {
        loadingActionCells: mingoHeaderLoadingCells(),
        showTimeTracker: isMdUp === false,
        showTicketAlerts: isMdUp === false,
        onMingoAI: () => router.push(routes.mingo.home),
        isMingoAIActive: false,
        customCells: chatEnabled
          ? [
              {
                id: 'chat-history',
                // Not the clock: the time tracker beside it is one.
                icon: <ChatsIcon className="h-6 w-6" />,
                label: 'Chat history',
                onClick: () => setMobileMenuOpen(true),
                mobileOnly: true,
              },
            ]
          : [],
      }),
    }),
    [
      chromeLoading,
      chatEnabled,
      toggleChat,
      chatOpen,
      openHelpCenterTickets,
      slots.mobileMingoCells,
      isMdUp,
      router,
      setMobileMenuOpen,
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

  const chatDrawer = slots.chatDrawer ? (
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
          // No `AppLayoutDrawerTitle` is rendered (see below), so Radix's
          // `aria-labelledby` points at an id that doesn't exist and the dialog has
          // no accessible name. That was survivable while the drawer only ever
          // opened from a click; a deep link opens it with no user gesture, moving
          // focus into an unnamed dialog.
          aria-label="Mingo AI chat"
          // See WALKTHROUGH_OVERLAP_Z: the z-index belongs on Content (which
          // owns the stacking context), not on the panel inside it.
          style={WALKTHROUGH_OVERLAP_Z.content}
          overlayClassName={WALKTHROUGH_OVERLAP_Z.overlay}
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

  // Mingo v2: the chat docked beside the page as the layout's side panel. Not an
  // overlay, so it neither closes on navigation nor offers a close button while
  // docked; the launcher's `isOpen` only means "opened from the header", which is
  // how it shows when there is no room to dock (and on a phone). The compaction
  // watchers live in `MingoChatProvider`: they must outlive the panel, which
  // unmounts while hidden.
  const chatSidePanel: AppLayoutSidePanelConfig | undefined = slots.chatSidePanel
    ? {
        label: 'Mingo AI chat',
        minWidth: MINGO_V2_RAIL_WIDTH,
        // A first launch opens the list beside a new chat, as much of it as fits.
        defaultWidth: MINGO_V2_SPLIT_WIDTH + SIDE_PANEL_FRAME_WIDTH,
        // v2: widths chosen before the default existed start over at it.
        storageKey: 'openframe:mingo-panel-v2',
        collapsed: isFullWidthPage(pathname),
        open: chatOpen,
        onOpenChange: setChatOpen,
        children: state => <MingoSidePanel {...state} identityEnabled={chatIdentityEnabled} />,
      }
    : undefined;

  return (
    <>
      {slots.dialogUrlSync && <ClassicMingoDialogUrlSync canOpenDrawer={chatEnabled} />}
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
          <Suspense fallback={null}>
            <UnreadCountsHydrator onChange={setUnreadCounts} />
          </Suspense>
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
              can show it (drawer / side panel, and the page). Gated like the chat
              surfaces themselves; it runs only while one of them is mounted. */}
          <MingoChatProvider enabled={chatMounted} identityEnabled={chatIdentityEnabled}>
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
              // `sidebarConfig.currentPath`. The classic shell leaves it to the layout.
              mobileMenuOpen={grouped ? mobileMenuOpen : undefined}
              onMobileMenuOpenChange={grouped ? setMobileMenuOpen : undefined}
              // Greys the header and nav rail out for the lock: they stay legible —
              // the user can still see where they are and reach the account menu —
              // but nothing they lead to is reachable until the workspace is paid for.
              disabled={showLockContent}
              drawer={chatDrawer}
              sidePanel={chatSidePanel}
              topBar={topBar}
              // The Mingo-first shell: no desktop header (the phone top bar stays; the
              // bell, the time tracker and the ticket alerts move into the sidebar
              // header, `headerSlot` above); the composer is docked under every page —
              // `null` behind the paywall, which keeps the slot (and the page's layout)
              // while drawing nothing. Both are plain props on the same element, so
              // switching shells never remounts the page.
              desktopHeader={slots.desktopHeader}
              composerDock={
                slots.composerDock === 'dock' ? (
                  <MingoComposerDock />
                ) : slots.composerDock === 'empty' ? null : undefined
              }
              // A chat page: Mingo's background and glow from the top of the thread
              // to the bottom of the window, under the docked composer too.
              pageSurface={slots.composerDock === 'dock' && composerRouteOf(pathname) === 'chat' ? 'mingo' : undefined}
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
              <Suspense fallback={null}>{showLockContent ? <SubscriptionLockContent /> : children}</Suspense>
            </CoreAppLayout>
            {/* The chat history's search modal, once (the section is drawn twice). */}
            {grouped && chatEnabled && <MingoHistorySearch />}
          </MingoChatProvider>
        </TicketLiveProvider>
      </TimeTrackerHostProvider>
      {/* Onboarding progress hydrator (fetches backend progress into the store)
          + coach-mark (shows only when a page was reached from an onboarding step
          via the `setupHint` query param). Gated on the session so the queries
          never fire before `/me` has answered, and on the lock because a locked
          workspace shows no onboarding — and its request would be held by the
          subscription gate rather than answered (see `chromeLoading`). */}
      {sessionReady && !isLocked && withOnboarding && (
        <>
          <OnboardingProgressHydrator />
          <OnboardingCoachMark />
        </>
      )}
      {/* Reports what the billing banners above need. Suspends, so it sits in
          its own boundary and renders nothing either way — a shell that waited
          on it would hold the whole app for a banner. */}
      {showBillingBars && (
        <Suspense fallback={null}>
          <BillingBarsHydrator onResolved={setBillingBars} />
        </Suspense>
      )}
      {/* Desktop shell update offer. Also owns the mount-time availability
          check that the sidebar's update button reads. No-op elsewhere. */}
      <DesktopUpdateModal />
      {/* Floating walkthrough/demo video — the same widget every other Flamingo
          platform ships, mounted ONCE for the whole app next to the chat
          drawer. Which bottom corner it pins to is content-managed (the hub
          admin sets it per platform). Left out behind the subscription lock for
          the same reason the Mingo launcher is: that screen is not the app.
          After the session is in place, like the chat: its read is refused before. */}
      {sessionReady && !isLocked && <WalkthroughVideo />}
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
        </>
      )}
      {/* Logout confirmation modal — opened from the nav user menu, the Settings
          "Log Out" button, and the lock screen's, all via `useLogoutConfirmStore`.
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
    <Suspense fallback={null}>
      {/* The admin look for every tab strip; the lib's `default` is the hub's. */}
      <TabNavigationVariantProvider variant="admin">
        <AppLayoutInner mainClassName={mainClassName}>{children}</AppLayoutInner>
      </TabNavigationVariantProvider>
    </Suspense>
  );
}
