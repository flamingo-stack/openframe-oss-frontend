/**
 * The auth adapter the core lib's `embedAuthedFetch` consults, and its registration.
 *
 * Its own module, so the ROOT layout can register it: the agents' identities
 * (`agent-identity-root.tsx`) do, at module load, and in a tenant mode every other
 * `contentFetch` / `embedAuthedFetch` caller and every lib picture finds it registered. The chat
 * provider under `(app)` repeats the call, so it does not depend on the root's load order. The
 * lib's `contentFetch` is a plain `fetch` until then, and the registration used to sit in the
 * chat provider's module, which only `(app)/layout.tsx` loads. A sign-in made from the login screen makes the session
 * ready on `/auth`, before any `(app)` route has been evaluated: the identities were read with no
 * bearer, the gateway answered 401, and that read is asked once, so every agent's mark (the Mingo
 * icon on the start screen) stayed an empty box until the shell was restarted.
 */

import {
  clearEmbedProxyAuth,
  type EmbedAuthAdapter,
  setEmbedAuthAdapter,
} from '@flamingo-stack/openframe-frontend-core/utils';
import { isSaasSharedMode } from '@/lib/app-mode';
import { clientIdentityHeaders } from '@/lib/client-identity';
import { resolveBackendImageUrl } from '@/lib/image-url';
import { runtimeEnv } from '@/lib/runtime-config';
import { isSessionGone, noteGatewayResponse, SessionGoneError } from '@/lib/session-health';
import { refreshAccessToken } from '@/lib/token-refresh-manager';
import { getBearerTokenSync, getTokenEpoch, isBearerAuthMode, subscribeToTokenChange } from '@/lib/token-store';
import { isUpdateRequired, noteUpgradeRequired, UpdateRequiredError } from '@/lib/version-check';

/**
 * Token epoch observed the last time this adapter attached credentials to an
 * outgoing request. Read back in `refresh()` so a 401 raised under a
 * credential that has ALREADY been replaced retries instead of rotating again.
 *
 * The adapter is a module singleton, so this is really the last HEADER BUILD
 * rather than the send that produced the 401 — the correlation is deliberately
 * loose. The stored epoch is still safe: it can only lag the current one, and
 * lagging means a rotation happened after that send, which is exactly when a
 * retry is the right answer. The failure mode is a missed short-circuit (one
 * extra refresh), never a retry with a genuinely dead token.
 *
 * Core classifies its pictures through `hasCredential`, which records nothing.
 * Every mounted picture re-classifies right after each rotation; had that gone
 * through `getHeaders`, it would have moved this epoch past the send whose 401
 * it is kept for.
 */
let lastSendEpoch = 0;

/**
 * The tenant gateway's origin, whenever auth rides in a header instead of a
 * cookie: the native shell and dev-ticket web (`isBearerAuthMode`). Both call
 * the gateway ABSOLUTE and cross-origin, so `embedAuthedFetch`'s guard has to
 * sanction exactly that origin, and core's pictures (`useAuthedAsset`) read the
 * same list to decide that a gateway image (`/api/images/...`) is fetched with
 * the bearer rather than loaded by a plain `<img>`, which carries no header and
 * gets a 401.
 *
 * It was the shell's `CONTENT_ORIGIN` alone, so on dev-ticket web every
 * organization logo and avatar answered 401.
 */
function bearerGatewayOrigins(): string[] {
  if (!isBearerAuthMode()) return [];
  try {
    return [new URL(runtimeEnv.tenantHostUrl()).origin];
  } catch {
    return [];
  }
}

/**
 * Auth adapter the lib's `embedAuthedFetch` consults on every request it makes: the chat, the
 * Help Center content, the agents' identities, bearer-fetched pictures. A module-scope object,
 * so it can be registered at module load. All deps it closes over are module-level.
 */
const EMBED_AUTH_ADAPTER: EmbedAuthAdapter = {
  getHeaders: () => {
    // Recorded for BOTH auth modes: cookie-mode rotations advance the epoch too
    // (`markTokenRotation` in the refresh manager), and requests ride cookies
    // there via `credentials: 'include'`.
    lastSendEpoch = getTokenEpoch();
    // Mirror `apiClient.getAuthHeaders()` EXACTLY: only attach a stored Bearer
    // in bearer mode (dev-ticket web or native shell). In normal cookie mode
    // the access token lives in an http-only cookie that `oauth/refresh`
    // rotates server-side; the client-side copy is only maintained in bearer
    // mode (token-refresh-manager gates its writes the same way). Sending a
    // copy outside bearer mode would ship a stale/expired Bearer that the
    // gateway prefers over the fresh cookie. Omit it and let
    // `credentials: 'include'` carry the cookie.
    const identity = clientIdentityHeaders();
    const token = getBearerTokenSync();
    return token ? { ...identity, Authorization: `Bearer ${token}` } : identity;
  },
  hasCredential: () => !!getBearerTokenSync(),
  // Send openframe cookies cross-origin to the gateway; CORS +
  // `SameSite=None` on cookies must be configured server-side. (Harmless
  // no-op in production, where the frontend and gateway share one origin.)
  credentials: 'include',
  // `refreshAccessToken` already dedups concurrent refreshes internally, and
  // `embedAuthedFetch` dedups 401-triggered retries on top — so a stampede of
  // simultaneously-expiring requests refreshes once. Passing the send-time
  // epoch closes the remaining gap: a 401 that lands AFTER that refresh
  // finished is stale news and resolves to a retry rather than a second
  // rotation (which, with rotating refresh tokens, invalidates the credential
  // just obtained).
  refresh: () => refreshAccessToken(lastSendEpoch),
  // Mobile force-update, as `apiClient`, Relay and the upload helpers do it:
  // once this bundle is refused nothing goes out, and a 426 flips the app into
  // the "Update required" screen ahead of the 401 → `refresh` path, never
  // retried. Both are no-ops off the mobile shell. A 410 (deleted tenant) is
  // refused the same way, on every shell (`session-health.ts`).
  beforeRequest: () => {
    if (isUpdateRequired()) throw new UpdateRequiredError();
    if (isSessionGone()) throw new SessionGoneError();
  },
  onResponse: async response => {
    if (await noteUpgradeRequired(response)) throw new UpdateRequiredError();
    if (noteGatewayResponse(response)) throw new SessionGoneError();
  },
  // The one origin the bearer belongs to, in bearer mode only (see
  // `bearerGatewayOrigins`). Empty on the cookie-auth web, where the
  // same-origin rule stays absolute.
  allowedOrigins: bearerGatewayOrigins(),
  // Every picture the lib draws asks this first: a backend image path
  // (`/images/user/1`) is served at the gateway's `/api`, never at the page's
  // origin, on web and in the shells alike.
  resolveAssetUrl: resolveBackendImageUrl,
  // Epoch-gated, per `EmbedAuthAdapter.subscribe`'s "real change only"
  // contract: `adoptNativeTokens` also emits when the shell hands back the SAME
  // token (a shell re-emitting the pair on resume), and the web branch of
  // `setTokens` emits on every write.
  subscribe: listener => {
    let seenEpoch = getTokenEpoch();
    return subscribeToTokenChange(() => {
      const epoch = getTokenEpoch();
      if (epoch === seenEpoch) return;
      seenEpoch = epoch;
      listener();
    });
  },
};

let registered = false;

/**
 * Registers the auth adapter + drops legacy proxy-auth ONCE. A caller runs it at ITS module
 * load, i.e. before it renders or any of its effects fires a request.
 * Why not in render / useEffect: the chat's identity & slash-command requests
 * fire from CHILD mount effects, which run before a parent `useEffect`; and a
 * `useState` initializer races StrictMode's double-invoke + the unmount-null,
 * leaving the first requests adapter-less (the `credentials: 'same-origin'` +
 * 401 + no-refresh symptom). The adapter is a module singleton: the token and the headers are
 * read per call, `allowedOrigins` once, when this module loads, which can be before the sign-in
 * (a login that changes the tenant host reloads the document, `tenantHostChanged`). So a single
 * app-lifetime registration with no teardown is correct, and the lib's "overwriting a
 * previously-registered adapter" warning never fires.
 *
 * Not on the shared-auth host. It has no tenant session to sign, and its one content read is
 * the hub's announcement, cross-origin: with an adapter registered the lib refuses it
 * (`embedAuthedFetch`'s same-origin rule) where the plain `fetch` reaches it.
 *
 * `clearEmbedProxyAuth()`: openframe never does proxy-impersonation, but an
 * earlier `setEmbedProxyAuth`-based approach persisted the openframe JWT under
 * `<appType>.chat.proxy-auth.v1`. That copy is frozen at login, so
 * `applyProxyAuth` kept attaching a stale/expired Bearer to `/content/*`.
 */
export function registerEmbedAuthAdapter(): void {
  if (registered || typeof window === 'undefined' || isSaasSharedMode()) return;
  registered = true;
  clearEmbedProxyAuth();
  setEmbedAuthAdapter(EMBED_AUTH_ADAPTER);
}
