'use client';

/**
 * The states a data surface can be in, and one place that derives them.
 *
 * ## Why this exists
 *
 * react-query gives three booleans that do not map onto what a page must render.
 * `isLoading` is `isPending && isFetching`, so a PAUSED query — which is what an
 * offline query now is, since `lib/connectivity.ts` gave `onlineManager` a real
 * signal — reports `isLoading: false`, `data: undefined`, `error: null`. Every
 * consumer written as `!isLoading && !data` then concludes "there is no data"
 * and renders an empty state, a "not found", or worse seeds a form with defaults
 * and lets the user Save them over real settings.
 *
 * Switching those consumers to `isPending` does not fix it either: paused is
 * `isPending: true`, so the skeleton never resolves. Both readings are wrong
 * because "we are offline and have nothing" is a THIRD state that neither
 * boolean expresses, and a query whose gate will never open is a fourth that
 * must not skeleton at all (see {@link QueryGate}).
 *
 * ## The rule that matters
 *
 * `canClaimEmpty` is the precondition for every "there is no data" conclusion.
 * An empty state, a not-found, and a prefill-from-data may only render once the
 * query has actually answered WITH data. Nothing else in this file is as
 * load-bearing.
 */

export interface QueryState {
  /**
   * First load in flight, or a gate that is expected to open shortly. Render the
   * skeleton. Never true while paused — a skeleton that cannot resolve is a lie.
   */
  isLoading: boolean;
  /**
   * No data and no link. Render "offline — updates when the connection returns",
   * and hide any Retry: `refetch` cannot run while `onlineManager` reports down,
   * so the button would do nothing.
   */
  isOffline: boolean;
  /**
   * The server refused the request with a 403. Render the "not available" copy
   * and hide any Retry: the answer will not change on a second attempt, so the
   * button would only re-run the same rejection. Kept apart from `error` so a
   * permission or missing-integration case never shows the raw transport string.
   */
  isForbidden: boolean;
  /** Terminal failure with no data. Render an error with a working Retry. */
  error: string | null;
  /**
   * The query produced DATA. The only safe precondition for prefilling a form or
   * enabling a Save that overwrites a record, because those need the record
   * itself, not merely an answer about it.
   */
  hasData: boolean;
  /**
   * Data arrived and nothing is obscuring it, so an empty result may be reported
   * AS empty — the empty state, the "not found", the "0 of 0".
   *
   * Given react-query's status derivation this currently equals `hasData` — `error`
   * is only computed when `data === undefined`, and `isOffline` requires
   * `isPending`, which also implies it. The conjuncts are kept because they state
   * the RULE rather than today's arithmetic, and because the name is what stopped
   * three list surfaces from each inventing their own version: offline and error
   * both leave a list at length zero, and "No customers yet" printed under a
   * "couldn't load" strip is a claim about the tenant the app has not earned.
   */
  canClaimEmpty: boolean;
}

/**
 * What an `enabled` expression MEANS, which react-query cannot infer: it sees
 * only `false`, and cannot tell "the session is still resolving" (will open)
 * from "OSS mode, so this query never runs" (will not). Reading both as
 * "loading" is what made a disabled query report loading forever.
 */
export type QueryGate = 'open' | 'closed';

interface QueryLike {
  isPending: boolean;
  isPaused: boolean;
  isError: boolean;
  data: unknown;
  error: { message?: string } | null;
}

export function queryState(query: QueryLike, gate: QueryGate = 'open'): QueryState {
  const isOffline = query.isPending && query.isPaused;
  const isLoading = query.isPending && !query.isPaused && gate === 'open';
  // A 403 with no data is its own terminal state, like offline: the raw transport
  // string never reaches the user, and the Retry is dropped because the answer
  // will not change.
  const isForbidden = query.isError && query.data === undefined && isForbiddenError(query.error);
  // Only a failure with NO data: a background refetch that fails while cached
  // rows are on screen is not an error state, it is stale data. The cost is that
  // a query which succeeded once and then fails every refetch reports `null`
  // forever — nothing here signals staleness, and no surface asks for it yet.
  const error =
    query.isError && query.data === undefined && !isForbidden ? query.error?.message || 'Request failed' : null;
  const hasData = query.data !== undefined;

  return {
    isLoading,
    isOffline,
    isForbidden,
    error,
    hasData,
    canClaimEmpty: hasData && !error && !isOffline && !isForbidden,
  };
}

/**
 * Copy for the offline phase, so every surface says the same thing.
 *
 * Deliberately NOT exported: surfaces reach it through `loadErrorProps`, which is
 * what guarantees the Retry disappears along with the copy. A surface that
 * imported the string alone would get half the rule.
 */
const OFFLINE_MESSAGE = "You're offline — this will update when the connection returns.";

/**
 * Copy for the 403 phase. One message covers both causes the user can act on:
 * the account lacks permission, or the tenant has no Fleet connection. Reached
 * through `loadErrorProps`, which drops the Retry along with it.
 */
const FORBIDDEN_MESSAGE = 'This section is not available. You may not have permission, or Fleet is not connected.';

/**
 * The `(message, Retry)` pair a failed load renders, decided in one place.
 *
 * The rule is not obvious enough to leave to every call site: offline swaps the
 * copy AND drops the Retry, because `refetch` cannot run while `onlineManager`
 * reports the link down — the button would be inert, which is worse than no
 * button. Recovery is not the user's job here anyway; the query resumes itself
 * when the link returns.
 *
 * Returns props rather than a component because the surfaces disagree on which
 * one to render — an inline `SectionLoadError` strip above surviving content, a
 * core-lib `LoadError` card that replaces it — while agreeing completely on what
 * it should say.
 *
 * `onRetry` is optional for the surfaces that can only take the copy: a
 * `DataTable`'s empty slot renders text and nothing else, but it must not be
 * left saying "No policies found." when the load is what failed.
 */
export function loadErrorProps(
  state: boolean | { isOffline?: boolean; isForbidden?: boolean },
  message: string,
  onRetry?: () => void,
): { message: string; onRetry?: () => void } {
  const isOffline = typeof state === 'boolean' ? state : !!state.isOffline;
  const isForbidden = typeof state === 'boolean' ? false : !!state.isForbidden;
  // Both terminal states swap the copy and drop the Retry — offline because the
  // link is down, forbidden because a second attempt returns the same rejection.
  if (isForbidden) return { message: FORBIDDEN_MESSAGE };
  return isOffline ? { message: OFFLINE_MESSAGE } : { message, onRetry };
}

/**
 * Thrown when a request gave up because there was no link, as opposed to a
 * server that answered badly.
 *
 * react-query expresses that difference as a `paused` fetch status. Relay has no
 * equivalent — it throws, and every throw looks alike to the boundary above it —
 * so `lib/relay/environment.ts` raises this instead, and
 * `ContentErrorBoundary` renders the offline copy with no Retry (retrying cannot
 * succeed while the link is down). Without it, half the app reported a genuine
 * outage as "Couldn't load this content" plus a button that does nothing.
 */
export class OfflineError extends Error {
  readonly isOfflineError = true;

  /** The Relay operation that gave up, for logs. Deliberately NOT in `message`. */
  readonly operation: string | undefined;

  constructor(operation?: string) {
    // `message` is user-facing: a mutation that fails offline surfaces it
    // through the caller's `onError` toast, which would otherwise read
    // "Offline: batchRunScriptMutation".
    super(OFFLINE_MESSAGE);
    this.name = 'OfflineError';
    this.operation = operation;
  }
}

/** Duck-typed so it survives bundle boundaries and re-thrown copies. */
export function isOfflineError(error: unknown): error is OfflineError {
  return (error as { isOfflineError?: unknown } | null)?.isOfflineError === true;
}

/**
 * Thrown when the server refused a request with a 403, as opposed to a request
 * that simply failed.
 *
 * A REST caller (see the Fleet hooks) throws this instead of a plain `Error`
 * carrying the upstream transport string, so `queryState` can report the
 * dedicated `isForbidden` state and no surface shows the raw
 * "Request failed with status code 403". Carries the shared copy in `message`
 * so a mutation that fails this way still reads well in a toast.
 */
export class ForbiddenError extends Error {
  readonly isForbiddenError = true;

  constructor() {
    super(FORBIDDEN_MESSAGE);
    this.name = 'ForbiddenError';
  }
}

/** Duck-typed so it survives bundle boundaries and re-thrown copies. */
export function isForbiddenError(error: unknown): error is ForbiddenError {
  return (error as { isForbiddenError?: unknown } | null)?.isForbiddenError === true;
}
