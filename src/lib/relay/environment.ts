'use client';

import type { FetchFunction, IEnvironment } from 'relay-runtime';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { REQUEST_TIMEOUT_MS } from '../api-client';
import { isOnline, subscribeConnectivity } from '../connectivity';
import { forceLogout } from '../force-logout';
import { OfflineError } from '../query-state';
import { runtimeEnv } from '../runtime-config';
import { waitForSessionReady } from '../session-ready';
import { detectTrialExpiredFromGraphqlErrors } from '../subscription-lock-signal';
import { refreshTokens } from '../token-refresh-manager';
import { getAccessTokenSync, getTokenEpoch, isBearerAuthMode } from '../token-store';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (isBearerAuthMode()) {
    const accessToken = getAccessTokenSync();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  return headers;
}

function getGraphqlUrl(): string {
  const tenantHost = runtimeEnv.tenantHostUrl();
  const baseUrl = tenantHost || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${baseUrl}/api/graphql`;
}

/**
 * Ceiling on a single GraphQL request. THE SAME constant `api-client.ts` applies
 * to REST, imported rather than restated so the two halves of the data layer
 * cannot drift. It exists for a reason that bites harder here: `fetch` never
 * times out on its own, and a Relay query that never settles keeps the `Suspense`
 * boundary above it open forever. That is a page skeleton with no error, no retry
 * and nothing logged — the exact failure this app has already shipped once.
 * Timing out turns it into an ordinary query error, which every boundary and
 * `useToast` path already handles.
 */
const RELAY_REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_MS;

async function executeFetch(
  request: Parameters<FetchFunction>[0],
  variables: Parameters<FetchFunction>[1],
  headers: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, RELAY_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(getGraphqlUrl(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...headers,
      },
      credentials: 'include',
      body: JSON.stringify({
        query: request.text,
        variables,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    // Rethrown as a plain Error on purpose: an `AbortError` reads as "someone
    // cancelled this" everywhere it surfaces, and this abort is a failure.
    if (timedOut) {
      throw new Error(`Relay fetch timed out after ${RELAY_REQUEST_TIMEOUT_MS}ms: ${request.name}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Transient-failure retry budget.
 *
 * Relay has no retry of its own, and that gap is the reason a momentary drop
 * turned into a permanent error page: `QueryResource` caches the rejection and
 * rethrows it for as long as the entry is retained — `TEMPORARY_RETAIN_DURATION_MS`,
 * 5 minutes, in react-relay's `SuspenseResource` — so the failure
 * outlives its cause by a wide margin and every one of the ~50 `useLazyLoadQuery`
 * call sites inherits that. react-query has had `retry` + backoff all along, so
 * this closes the gap — deliberately NOT the identical policy: react-query's is
 * declared per hook (`retry: 1`/`2`, flat 1s delay) with no shared default in
 * `query-client.ts`, while this one is jittered exponential under a time budget
 * because a Relay failure costs a thrown boundary rather than an error value.
 *
 * Retrying HERE rather than in the UI is the point. An error boundary means
 * "cannot render safely" — it is terminal, and clearing one costs an
 * unmount/remount, i.e. a skeleton flash. Recovering below the boundary means a
 * blip never reaches it: `Suspense` keeps showing the page's own loading state,
 * which is honest, because the request genuinely has not finished.
 *
 * ~1s + ~2s + ~4s ≈ 7s of cover before the error surfaces, which spans the
 * settle-after-reconnect window measured on device (1.2s and 6.7s across two
 * airplane-mode cycles). Jitter keeps a tenant's worth of clients from
 * retrying in lockstep after a shared outage.
 */
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;

/**
 * Ceiling on how long the sequence may keep SCHEDULING work, not on wall clock.
 *
 * The attempt budget alone is not a time budget: `RELAY_REQUEST_TIMEOUT_MS` is
 * 30s, so four attempts against a server that accepts and then never answers
 * would hold the skeleton for two minutes — far worse than the single timeout
 * this replaced. Retries are cheap in the case they exist for (an offline
 * transport rejects in milliseconds: 16–189ms in the device traces) and ruinous
 * in the case they do not, so elapsed time is the guard that matters.
 *
 * It bounds the elapsed time at which a further attempt may START. The attempt
 * already in flight is bounded by the request timeout instead, so the true worst
 * case is one full timeout on the last permitted attempt on top: 30s + ~1s +
 * 30s ≈ 61s against a server that hangs. Bounding wall clock exactly would mean
 * aborting a request that may still be about to answer, which is a worse trade
 * than a slow tail on a server that is already broken.
 */
const RETRY_TOTAL_BUDGET_MS = 20_000;

/**
 * How long to wait on a link we already know is down before reporting offline.
 *
 * Deliberately short. Spending the full retry budget here would mean ~20s of
 * skeleton before the user is told anything, and there is nothing to learn from
 * waiting: `isOnline()` already said the link is down. A couple of seconds
 * absorbs a momentary blip; past that, saying "you're offline" is both faster and
 * more honest.
 *
 * Giving up early is only safe because the failure is recoverable without the
 * user: `ContentErrorBoundary` subscribes to connectivity and re-issues the query
 * when the link returns.
 */
const OFFLINE_GRACE_MS = 2_000;

/**
 * Only failures a retry can plausibly fix. A 4xx is the server declining on the
 * merits and will decline identically next time; 401 in particular has its own
 * refresh path below and must not be retried behind its back. 408/429 are the
 * documented exceptions, and 5xx is the case retries exist for.
 */
function isRetriableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

function backoffDelayMs(attempt: number): number {
  const exponential = RETRY_BASE_DELAY_MS * 2 ** attempt;
  return exponential * (0.5 + Math.random() * 0.5);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Resolves `true` as soon as the link is back, `false` if it has not returned
 * within `timeoutMs`.
 *
 * This is what gives Relay the reconnect behaviour react-query gets free from
 * `onlineManager`: instead of burning the retry budget against a link that is
 * known to be down, the request waits and goes the moment connectivity returns.
 * `subscribeConnectivity` fires immediately with the current value, so the
 * already-online case is covered by the guard in the caller.
 */
function waitForOnline(timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    // `subscribeConnectivity` invokes the listener SYNCHRONOUSLY with the current
    // value, so on an already-online link the callback runs while `unsub` is still
    // unassigned. Hence `let` read from the closure rather than a `const` passed
    // in as an argument: the argument form is evaluated at the call site, inside
    // the temporal dead zone, and throws `ReferenceError` before `finish` is
    // reached. `settled` then stands in for the unsubscribe that could not happen
    // yet — the trailing `if (settled)` performs it once the binding exists, so
    // the listener never lingers in the module-level Set.
    let settled = false;
    let unsub: (() => void) | undefined;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub?.();
      resolve(value);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    unsub = subscribeConnectivity(online => {
      if (online) finish(true);
    });
    if (settled) unsub();
  });
}

/**
 * `executeFetch` plus the retry policy above, and the connectivity signal.
 *
 * Transport rejections (DNS, TLS, our own timeout) and retriable statuses are
 * re-attempted. A known-down link is handled differently from a failing server:
 * there is nothing to back off from, so the request waits for the link instead —
 * which also means recovery is immediate rather than up to a backoff late — and
 * if it never returns within the budget the failure is reported as an
 * `OfflineError` so the UI can say so instead of blaming the server.
 */
async function executeFetchWithRetry(
  request: Parameters<FetchFunction>[0],
  variables: Parameters<FetchFunction>[1],
  headers: Record<string, string>,
): Promise<Response> {
  const startedAt = Date.now();
  for (let attempt = 0; ; attempt++) {
    if (!isOnline()) {
      const remaining = RETRY_TOTAL_BUDGET_MS - (Date.now() - startedAt);
      const grace = Math.min(OFFLINE_GRACE_MS, remaining);
      if (grace <= 0 || !(await waitForOnline(grace))) {
        throw new OfflineError(request.name);
      }
    }

    const delay = backoffDelayMs(attempt);
    // Checked BEFORE sleeping, so the budget bounds when the error surfaces
    // rather than being noticed one attempt too late.
    const isLast = attempt === RETRY_ATTEMPTS || Date.now() - startedAt + delay >= RETRY_TOTAL_BUDGET_MS;
    try {
      const response = await executeFetch(request, variables, headers);
      if (isLast || !isRetriableStatus(response.status)) return response;
      // The body of a response we are about to discard holds its stream open
      // until GC; up to three of them per request.
      // `cancel()` REJECTS on a stream that already errored, and there is no
      // `unhandledrejection` handler in the app.
      response.body?.cancel().catch(() => undefined);
    } catch (error) {
      // A transport rejection with the link already down is an outage, not a
      // server fault — report it as such rather than as a generic failure.
      if (isLast) throw isOnline() ? error : new OfflineError(request.name);
    }
    await sleep(delay);
  }
}

/**
 * "Render this subtree on the client instead" — Next's own signal, not an error.
 *
 * A plain `Error` here works but is REPORTED: React recovers by client-rendering
 * the boundary, then Next surfaces it as a `Recoverable Error` in the dev overlay
 * on every single load, and logs it server-side per request. Neither is a real
 * failure — a server render with no session was never going to produce data.
 *
 * `digest === 'BAILOUT_TO_CLIENT_SIDE_RENDERING'` is the contract Next checks to
 * treat a throw as an intentional bail-out; it is exactly how `next/dynamic` with
 * `ssr: false` opts a component out of SSR. Both ends honor it:
 *   - `next/dist/client/react-client-callbacks/on-recoverable-error.js`
 *     — `if (isBailoutToCSRError(cause)) return;` → no overlay, no client report
 *   - `next/dist/server/app-render/create-error-handler.js`
 *     — returns the digest before logging, and `isRelevantError` excludes it
 *
 * The digest string is replicated rather than deep-imported from
 * `next/dist/shared/lib/lazy-dynamic/bailout-to-csr`, whose path is internal.
 * If a future Next were to change the string, this degrades LOUDLY — back to a
 * visible recoverable error — rather than silently swallowing a real failure.
 */
class BailoutToClientRenderError extends Error {
  readonly digest = 'BAILOUT_TO_CLIENT_SIDE_RENDERING';

  constructor() {
    super('Bail out to client-side rendering: Relay query has no session during server render');
  }
}

/**
 * Relay network fetch function.
 * Mirrors apiClient auth logic: cookie-based auth + 401 token refresh + force logout.
 */
const fetchRelay: FetchFunction = async (request, variables) => {
  // No GraphQL during a server render. There is no user cookie in the Node
  // process, so the request would 401 — and the 401 path below calls
  // `refreshAccessToken`/`forceLogout`, which touch `window` and localStorage.
  //
  // Throwing (rather than just refusing) is what SETTLES the Suspense boundary.
  // A query left pending keeps its boundary open, and React's stream stays open
  // until every boundary settles — that is what made every Relay route's HTTP
  // response never finish while its HTML was already flushed and interactive
  // (see `session-ready.ts`). Settling it makes React emit the fallback — the
  // page's own skeleton — close the stream, and re-render this subtree on the
  // client, where the session and cookies exist.
  if (typeof window === 'undefined') {
    throw new BailoutToClientRenderError();
  }

  const isMutation = request.operationKind === 'mutation';

  // Checked ABOVE the session gate, because offline is already the answer and
  // waiting cannot improve it. `/me` is a react-query query, so offline it is
  // PAUSED, `markSessionReady()` never fires, and the gate below rides all the
  // way to its 10s fail-open (see `session-ready.ts`) — a read would then spend
  // its own grace window on top before the retry layer could say "you're
  // offline". Twelve seconds of skeleton for something already known.
  //
  // `isOnline()` starts optimistically `true` on native until the plugin's first
  // `getStatus()` resolves, so a cold start that begins offline can slip past
  // this and fall back to the slower path below. It does not in practice —
  // `query-client.ts` wires `onlineManager` at module scope, which starts the
  // source long before hydration — and a false "online" costs one request that
  // fails the way any request can.
  //
  // Reads only. A write falls through to the ordinary transport rejection its
  // `onError` handler already renders, for the same reason it skips the retry
  // policy below.
  if (!isMutation && !isOnline() && !(await waitForOnline(OFFLINE_GRACE_MS))) {
    throw new OfflineError(request.name);
  }

  // Every Relay query waits for the session (see `session-ready.ts`). This is
  // what lets a page render — and therefore CALL its query hooks — before `/me`
  // answers: the request simply doesn't leave, Relay suspends, and the page shows
  // its own `<Suspense>` fallback instead of a central route skeleton.
  await waitForSessionReady();

  // QUERIES retry; MUTATIONS get exactly one attempt.
  //
  // A retry is only safe when the operation is idempotent, and these are not:
  // `runScript`, `batchRunScript`, `createCheckoutSession`, `cancelSubscription`,
  // `createArticle` and ~60 other mutation artifacts all go through this same
  // network layer. Retrying them on a 5xx/408/429 — or on this module's own 30s
  // timeout, which fires just as happily on a slow request the server COMPLETED —
  // means a script executing twice on a customer's endpoint, or two Stripe
  // checkout sessions. The retry policy above exists for reads; applying it to
  // writes without idempotency keys trades a transient error for a duplicated
  // side effect.
  //
  // The same reasoning skips `waitForOnline`: a write attempted offline should
  // fail immediately so the caller's `onError` toast and optimistic rollback run,
  // not sit queued behind a link that may never return.
  const send = isMutation ? executeFetch : executeFetchWithRetry;

  // Captured BEFORE the request goes out: a 401 that comes back after the
  // credential has already rotated needs a retry, not another rotation.
  const sentAtEpoch = getTokenEpoch();
  let response = await send(request, variables, getAuthHeaders());

  // --- 401 handling: token refresh, then retry once ---
  if (response.status === 401) {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    if (currentPath.startsWith('/auth')) {
      throw new Error('Unauthorized');
    }

    // `refreshTokens` both deduplicates against an in-flight refresh and
    // short-circuits when `sentAtEpoch` is already stale, so the two arms of
    // the old `isTokenRefreshing()` branch collapse into one call.
    const outcome = await refreshTokens(sentAtEpoch);
    if (outcome !== 'refreshed') {
      // Only a 401 from the refresh endpoint is a rejected credential; a
      // dropped link, a timeout or an auth-server 5xx is `transient`
      // (`token-refresh-manager.ts`). The tokens are still good — the boundary
      // shows the offline copy and re-issues when the link returns.
      if (outcome === 'transient') {
        if (!isOnline()) throw new OfflineError(request.name);
        throw new Error(`Relay fetch failed: authentication temporarily unavailable (${request.name})`);
      }
      await forceLogout({ reason: 'Relay - token refresh failed' });
      throw new Error('Authentication failed');
    }
    response = await send(request, variables, getAuthHeaders());
  }

  if (!response.ok) {
    throw new Error(`Relay fetch failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();

  if (json.errors) {
    console.error('[Relay] GraphQL errors:', json.errors);
    detectTrialExpiredFromGraphqlErrors(json.errors);
  }

  return json;
};

/**
 * Types whose `id` is a VALUE, not an identity — opted out of Relay's global
 * record normalization.
 *
 * Relay keys every record with an `id` into one global store entry, so two
 * results carrying the same `id` merge (last write wins). That is correct for
 * entities but wrong for these, whose `id` the backend can legitimately repeat:
 *
 * - `SubscriptionOptionDetail` — documented as a "stable unique identifier for
 *   Relay normalization", but its slot disambiguation is buggy: an EXPIRED, an
 *   ACTIVE and a PENDING_ACTIVATION option all collapse to `...:<date>#1`, and
 *   the merge silently dropped the ACTIVE option so the current-plan view fell
 *   back to PAYG.
 * - `OrganizationFilterOption` — the `id` is the organizationId used as a
 *   filter value (`LogFilters.organizations`), and the backend emits the same
 *   one for differently-named organizations. Merging them made the logs
 *   organization filter show one name for both entries (and RelayResponse-
 *   Normalizer warn about the conflicting `name`), after which
 *   `deduplicateFilterOptions` collapsed them to a single, possibly wrong,
 *   option.
 *
 * Returning `undefined` stores each list entry under a parent-scoped client id
 * (by field + index) instead, so colliding backend ids no longer merge. Safe
 * for both: neither is a `Node`, neither is fetched via `node(id:)`, and both
 * are only read inline through their parent. Everything else keeps the default
 * id-based normalization.
 */
const UNNORMALIZED_TYPES = new Set(['SubscriptionOptionDetail', 'OrganizationFilterOption']);

function resolveDataId(value: { readonly id?: unknown }, typeName: string): string | undefined {
  if (UNNORMALIZED_TYPES.has(typeName)) return undefined;
  return typeof value.id === 'string' ? value.id : undefined;
}

let relayEnvironment: IEnvironment | null = null;

/**
 * Get or create the singleton Relay Environment.
 */
export function getRelayEnvironment(): IEnvironment {
  if (typeof window === 'undefined') {
    return new Environment({
      network: Network.create(fetchRelay),
      store: new Store(new RecordSource()),
      isServer: true,
      // biome-ignore lint/style/useNamingConvention: Relay's Environment option key is fixed.
      getDataID: resolveDataId,
    });
  }

  if (!relayEnvironment) {
    const store = new Store(new RecordSource(), {
      gcReleaseBufferSize: 20,
      queryCacheExpirationTime: 5 * 60 * 1000,
    });
    relayEnvironment = new Environment({
      network: Network.create(fetchRelay),
      store,
      // biome-ignore lint/style/useNamingConvention: Relay's Environment option key is fixed.
      getDataID: resolveDataId,
    });
  }

  return relayEnvironment;
}

/**
 * Reset the Relay environment (useful for logout/auth changes).
 */
export function resetRelayEnvironment(): void {
  relayEnvironment = null;
}
