'use client';

import { LoadError, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Component, createContext, type ReactNode, useContext } from 'react';
import { isOnline, subscribeConnectivity } from '@/lib/connectivity';
import { isOfflineError, loadErrorProps } from '@/lib/query-state';

/**
 * The retry counter a tripped `ContentErrorBoundary` publishes to its subtree.
 *
 * Relay is the reason this exists rather than a plain "clear the error" button.
 * `QueryResource` keys its cache on the query's `cacheIdentifier`, which includes
 * `fetchKey`, and its entry is temporarily retained for five minutes
 * (`TEMPORARY_RETAIN_DURATION_MS`, in react-relay's `SuspenseResource`) — so a boundary that
 * only clears its own state remounts the children, Relay hands back the same
 * cached rejection, and the boundary re-trips instantly. A Retry that visibly
 * does nothing is worse than no Retry.
 *
 * Composing this counter into a query's `fetchKey` changes the cache identifier,
 * which is the only thing that forces a real refetch. Zero outside a boundary, so
 * the hook is safe to call unconditionally.
 */
const RetryKeyContext = createContext(0);

/**
 * Read the enclosing boundary's retry counter. Compose it into a Relay
 * `fetchKey` (see `devices/hooks/use-device-list.ts` for the established shape)
 * so pressing Retry actually re-issues the request.
 */
export function useRetryKey(): number {
  return useContext(RetryKeyContext);
}

interface ContentErrorBoundaryProps {
  children: ReactNode;
  /**
   * Changing this clears a tripped boundary on its own — pass whatever already
   * means "the user asked for something different", typically the query string.
   */
  resetKey?: string;
  /** Overrides the default copy; the thrown error's message is never shown raw. */
  message?: string;
  /** Ran alongside the internal retry, for surfaces with their own refetch. */
  onRetry?: () => void;
  /** Console prefix identifying the surface. */
  label?: string;
  /**
   * Page title to redraw above the error.
   *
   * Most pages render their `PageLayout` INSIDE the component that fetches, so a
   * throw takes the title with it and the user is left with a bare card and no
   * idea which page failed. Passing the title lets the boundary put the chrome
   * back — the same thing `DevicesPanel` does by hand, without every caller
   * rebuilding a `PageLayout`.
   */
  title?: string;
  /**
   * Renders the failed state instead of the default inline `LoadError`.
   *
   * For surfaces whose page chrome lives INSIDE the subtree that throws and so
   * disappears with it — `DevicesPanel` is the case: its header, back button and
   * view switch are rendered by the content component, so the fallback has to
   * redraw that `PageLayout` or the user loses the page's identity along with
   * its rows. Presentation is the only thing this changes; catching, reset and
   * the retry key stay here.
   *
   * `state.isOffline` says the failure was a dead link rather than a bad answer;
   * pass it to `loadErrorProps` like every other surface does.
   */
  fallback?: (retry: () => void, state: { isOffline: boolean }) => ReactNode;
}

interface ContentErrorBoundaryState {
  failed: boolean;
  /** Retained so `render` can re-throw the ones that were never ours to catch. */
  error: unknown;
  resetKey: string | undefined;
  retryKey: number;
}

/**
 * Next signals `notFound()` and `redirect()` by THROWING, and those throws travel
 * the same path as a real failure. A catch-all boundary swallows them: a correct
 * 404 turns into "Couldn't load this content" with a Retry that re-runs
 * `notFound()` and re-trips forever.
 *
 * Matched on the digest prefixes Next itself uses —
 * `HTTP_ERROR_FALLBACK_ERROR_CODE` in
 * `next/dist/client/components/http-access-fallback/http-access-fallback.js` and
 * `REDIRECT_ERROR_CODE` in `next/dist/client/components/redirect-error.js`. Read
 * rather than imported: both live under `next/dist`, which is internal.
 */
function isControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === 'string' && (digest.startsWith('NEXT_HTTP_ERROR_FALLBACK') || digest.startsWith('NEXT_REDIRECT'))
  );
}

/**
 * Scoped error boundary for a page's data-dependent content.
 *
 * Place it INSIDE a page's own chrome, around the part that depends on a
 * request. A failed query then replaces that region — not the page, and not the
 * app — so the header, filters and navigation the user was working with survive.
 *
 * It exists because the two halves of the data layer fail differently and used to
 * land in different places. Relay's `useLazyLoadQuery` THROWS, so without a
 * boundary the failure escapes to the route boundary and replaces the page;
 * react-query returns an `error` value, which several tables ignored entirely and
 * rendered as an empty state, telling the user they had no data when the request
 * had simply failed. Both now render this, so behaviour is identical whichever
 * client the page happens to use.
 *
 * Reaching here should be uncommon: transient failures are retried below, in
 * `lib/relay/environment.ts` and react-query's own policy. This is the state
 * after that budget is spent.
 *
 * ## Why a class
 *
 * Not a style choice — React still has no hook equivalent. Catching a render
 * error requires `getDerivedStateFromError` / `componentDidCatch`, which exist
 * only on classes; that is unchanged in React 19 (19.2.4 here), and
 * `react-error-boundary` (itself a class behind a hook-shaped API) is not a
 * dependency. Next's `error.tsx` files look like function components only
 * because Next wraps them in its own class boundary. Every other boundary here
 * is a class for the same reason — `chat-drawer-error-boundary.tsx`,
 * `log-drawer-details.tsx`, `mention-tag.tsx`.
 */
export class ContentErrorBoundary extends Component<ContentErrorBoundaryProps, ContentErrorBoundaryState> {
  state: ContentErrorBoundaryState = { failed: false, error: null, resetKey: this.props.resetKey, retryKey: 0 };

  private unsubscribeConnectivity: (() => void) | undefined;

  /**
   * At most ONE automatic retry per reconnect, and the whole reason
   * `componentDidUpdate` is safe.
   *
   * A retry only works if the subtree's Relay queries compose `useRetryKey` into
   * their `fetchKey`, and several under a boundary still don't
   * (`edit-schedule-page`, `knowledge-base-table`, `run-script-view`,
   * `schedule-run-details-view`…).
   * For those the `cacheIdentifier` is unchanged, `QueryResource` rethrows the
   * RETAINED rejection during the very next render, and the boundary re-trips —
   * whose commit calls `componentDidUpdate` again. Without this latch that is an
   * unbounded synchronous loop ending in React's "Maximum update depth exceeded",
   * i.e. the reconnect path crashing the page it was added to rescue.
   *
   * Cleared on the next reconnect EDGE, and on any commit where the retry
   * actually cleared the boundary. A re-throw during the retry render never
   * commits `failed: false`, so the latch survives it and the second attempt
   * never happens.
   */
  private autoRetryPending = false;

  static getDerivedStateFromError(error: unknown): Partial<ContentErrorBoundaryState> {
    return { failed: true, error };
  }

  static getDerivedStateFromProps(
    props: ContentErrorBoundaryProps,
    state: ContentErrorBoundaryState,
  ): Partial<ContentErrorBoundaryState> | null {
    if (props.resetKey === state.resetKey) return null;
    // Only when there is something to clear. Bumping `retryKey` on every reset
    // would change the `fetchKey` of every query below on every search keystroke,
    // busting Relay's store cache for the ones whose variables did not change.
    if (!state.failed) return { resetKey: props.resetKey };
    // Recovering from a failure, `retryKey` moves for the same reason `retry`
    // moves it: clearing `failed` alone remounts the children onto Relay's
    // RETAINED rejection (see `RetryKeyContext`), so the boundary re-trips on the
    // next render and the user's new search looks like it broke the page.
    return { failed: false, error: null, resetKey: props.resetKey, retryKey: state.retryKey + 1 };
  }

  componentDidMount() {
    // An offline failure is the one state that CANNOT clear itself: the request
    // waited for the link, gave up, and the offline copy deliberately carries no
    // Retry (it could not work). Without this the boundary is a dead end — the
    // network comes back and the page stays on "you're offline" forever, because
    // `resetKey` only changes when the USER does something.
    //
    // Scoped to the offline case on purpose. A genuine failure must NOT
    // auto-retry: each attempt swaps this error for a skeleton, so a loop that
    // keeps failing reads as the page flickering between loading and broken.
    // Here the trigger is a real event — the link returned — not a timer.
    this.unsubscribeConnectivity = subscribeConnectivity(online => {
      if (!online) return;
      // A genuine reconnect earns a fresh attempt, even if the previous one was
      // spent. `publish` only fires on a CHANGE, so this is an edge, not a poll.
      this.autoRetryPending = false;
      this.retryIfOfflineResolved();
    });
  }

  componentDidUpdate() {
    // Closes a lost edge the listener above cannot see. The two events are
    // CORRELATED, not independent: the request gave up after spending
    // `OFFLINE_GRACE_MS` waiting for exactly this link, so a reconnect landing in
    // the gap between the throw and React committing `failed: true` is a likely
    // ordering rather than a freak one. The listener would find `failed` still
    // false, return, and the boundary would then settle into offline copy that
    // has no Retry, no timer and no `resetKey` to change — stuck until the
    // subtree unmounts.
    if (!this.state.failed) this.autoRetryPending = false;
    this.retryIfOfflineResolved();
  }

  componentWillUnmount() {
    this.unsubscribeConnectivity?.();
  }

  private retryIfOfflineResolved(): void {
    if (this.autoRetryPending) return;
    if (!this.state.failed || !isOfflineError(this.state.error) || !isOnline()) return;
    this.autoRetryPending = true;
    this.retry();
  }

  componentDidCatch(error: unknown) {
    if (isControlFlowError(error)) return;
    console.error(`[${this.props.label ?? 'ContentErrorBoundary'}]`, error);
  }

  private retry = () => {
    // The counter moves BEFORE the children remount, so they read the new value
    // on their first render and Relay treats it as a different query.
    this.setState(prev => ({ failed: false, error: null, retryKey: prev.retryKey + 1 }));
    this.props.onRetry?.();
  };

  render() {
    // Re-thrown, not rendered: `notFound()`/`redirect()` belong to the boundary
    // Next puts above this one.
    if (this.state.failed && isControlFlowError(this.state.error)) {
      throw this.state.error;
    }

    if (this.state.failed) {
      // Offline is not a failure of this page, and Retry cannot fix it — the
      // request already waited for the link and gave up (see
      // `lib/relay/environment.ts`). Saying "couldn't load" and offering a button
      // that cannot work is the thing react-query surfaces as `paused`; this is
      // the Relay equivalent.
      const offline = isOfflineError(this.state.error);

      // Passed the phase rather than skipped when offline: the fallback exists to
      // redraw page chrome, and losing that chrome precisely when the network is
      // down would be the worst moment for it.
      const custom = this.props.fallback?.(this.retry, { isOffline: offline });
      if (custom) return custom;

      const body = (
        <LoadError {...loadErrorProps(offline, this.props.message ?? "Couldn't load this content.", this.retry)} />
      );
      return this.props.title ? (
        <PageLayout title={this.props.title} contentClassName="flex flex-col">
          {body}
        </PageLayout>
      ) : (
        body
      );
    }
    return <RetryKeyContext.Provider value={this.state.retryKey}>{this.props.children}</RetryKeyContext.Provider>;
  }
}
