'use client';

import type { FetchFunction, IEnvironment } from 'relay-runtime';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { forceLogout } from '../force-logout';
import { runtimeEnv } from '../runtime-config';
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

async function executeFetch(
  request: Parameters<FetchFunction>[0],
  variables: Parameters<FetchFunction>[1],
  headers: Record<string, string>,
): Promise<Response> {
  return fetch(getGraphqlUrl(), {
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
  });
}

/**
 * Relay network fetch function.
 * Mirrors apiClient auth logic: cookie-based auth + 401 token refresh + force logout.
 */
const fetchRelay: FetchFunction = async (request, variables) => {
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
