'use client';

import type { FetchFunction, IEnvironment } from 'relay-runtime';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { forceLogout } from '../force-logout';
import { runtimeEnv } from '../runtime-config';
import { waitForSessionReady } from '../session-ready';
import { detectTrialExpiredFromGraphqlErrors } from '../subscription-lock-signal';
import { refreshAccessToken } from '../token-refresh-manager';
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
 * Ceiling on a single GraphQL request. Mirrors `REQUEST_TIMEOUT_MS` in
 * `api-client.ts` and exists for the same reason, which bites harder here:
 * `fetch` never times out on its own, and a Relay query that never settles keeps
 * the `Suspense` boundary above it open forever. That is a page skeleton with no
 * error, no retry and nothing logged — the exact failure this app has already
 * shipped once. Timing out turns it into an ordinary query error, which every
 * boundary and `useToast` path already handles.
 */
const RELAY_REQUEST_TIMEOUT_MS = 30_000;

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

  // Every Relay query waits for the session (see `session-ready.ts`). This is
  // what lets a page render — and therefore CALL its query hooks — before `/me`
  // answers: the request simply doesn't leave, Relay suspends, and the page shows
  // its own `<Suspense>` fallback instead of a central route skeleton.
  await waitForSessionReady();

  // Captured BEFORE the request goes out: a 401 that comes back after the
  // credential has already rotated needs a retry, not another rotation.
  const sentAtEpoch = getTokenEpoch();
  let response = await executeFetch(request, variables, getAuthHeaders());

  // --- 401 handling: token refresh, then retry once ---
  if (response.status === 401) {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    if (currentPath.startsWith('/auth')) {
      throw new Error('Unauthorized');
    }

    // `refreshAccessToken` both deduplicates against an in-flight refresh and
    // short-circuits when `sentAtEpoch` is already stale, so the two arms of
    // the old `isTokenRefreshing()` branch collapse into one call.
    const refreshed = await refreshAccessToken(sentAtEpoch);
    if (!refreshed) {
      await forceLogout({ reason: 'Relay - token refresh failed' });
      throw new Error('Authentication failed');
    }
    response = await executeFetch(request, variables, getAuthHeaders());
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
