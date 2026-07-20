/**
 * guide-chat-hub-proxy — server-only streaming pass-through from the app's
 * same-origin `/api/guide-chat/*` routes to the multi-platform-hub chat
 * backend. This is what lets Guide mode run in the embedded chat without
 * the browser ever learning the hub origin or the service token.
 *
 * Contract (Phase 5, guide-mode restoration):
 *   - `HUB_CHAT_BASE_URL` is an ORIGIN env (no path) — e.g.
 *     `https://hub.openframe.ai` or `http://localhost:3000` in dev.
 *   - `CHAT_SERVICE_TOKEN` is a SERVER-HELD secret. The hub honors
 *     `x-chat-service-token` + `x-openframe-chat-source: openframe` on
 *     POST /api/docs/chat, POST /api/chat/agent/confirm-tool and
 *     GET /api/docs/commands, waiving auth with a 'service' tier (no debug
 *     powers). When the token env is unset we still proxy — the hub then
 *     treats the request as anonymous (degraded, but functional for public
 *     sources), which also keeps local dev usable without the secret.
 *   - The request body is forwarded RAW (`request.body` + `duplex: 'half'`)
 *     and the client abort propagates via `signal: request.signal`.
 *   - The upstream body is returned UNTOUCHED (`new Response(upstream.body)`).
 *     NEVER buffer or re-encode: the chat wire is a byte protocol using
 *     control bytes (\0, \x1E, \x1F) that any text round-trip would corrupt.
 *   - App cookies / Authorization are NOT forwarded to the hub (the service
 *     token IS the identity), and the token never reaches the browser (no
 *     NEXT_PUBLIC_ prefix).
 *   - The VISITOR's IP is forwarded as `x-chat-ip`. See
 *     `visitorIpFrom()` for why this is load-bearing, not optional — and
 *     why the header precedence there is a security boundary.
 */

import { normalizeIpForBucketKey } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { NextResponse } from 'next/server';

/** Resolve the hub origin, normalizing away any trailing slash. */
function hubOrigin(): string | null {
  const raw = process.env.HUB_CHAT_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

/** Emitted once per process — a deployed misconfiguration must not be silent. */
let warnedMissingServiceToken = false;

/**
 * Normalization of a candidate address is the LIB's job, not ours:
 * `normalizeIpForBucketKey` (`@flamingo-stack/openframe-frontend-core/chat-protocol`)
 * is the one rule both this proxy (the producer of `x-chat-ip`) and the hub
 * (the consumer that buckets on it) apply. They previously each had their own
 * — differing on `%zone` and IPv4-mapped forms — so one visitor could land in
 * two rate-limit buckets depending on which side normalized.
 *
 * Getting this right is not a cosmetic nit in either direction: a false
 * negative means NO `x-chat-ip` is sent at all and every visitor silently
 * collapses back into this app's single egress bucket, and a pass-through of
 * junk could smuggle CR/LF or extra header material into the forwarded value.
 * The lib handles the routinely-seen non-canonical forms (`[::1]:443`
 * brackets + port, `fe80::1%eth0` zone ids, `::ffff:203.0.113.4` IPv4-mapped)
 * and rejects everything that isn't recognisably an address.
 */

/** Emitted once per process — a silently degraded bucket must be observable. */
let warnedMissingVisitorIp = false;

/**
 * Extract the end user's IP from the incoming request.
 *
 * WHY THIS MATTERS — do not "simplify" this away: without a forwarded
 * visitor identity the hub can only bucket by this app server's single
 * egress IP, so (a) the hub's guide-mode rate limit (5 req/min) is shared by
 * EVERY user of this deployment — the 6th guide request in a minute 429s for
 * everyone — and (b) every guide conversation persists under the same
 * pseudo-visitor, destroying per-user conversation attribution.
 *
 * The hub honors `x-chat-ip` only on requests that also carry a valid
 * `x-chat-service-token`; the service token IS the trust proof. We must NOT
 * forward the impersonation-grade `CHAT_PROXY_SECRET` here — this proxy
 * speaks for anonymous visitors and must not hold that power.
 *
 * HEADER PRECEDENCE IS A SECURITY BOUNDARY, AND TRUST IS EXPLICIT.
 * Because the hub trusts whatever we put in `x-chat-ip`, reading a header
 * that NOBODY on the request path overwrites hands the visitor their own
 * rate-limit bucket: rotating `curl -H '<that header>: <random>'` defeats the
 * guide limit entirely and attributes conversations to forged visitors. A
 * header is only overwritten-by-the-ingress on deployments that actually run
 * that ingress, so each vendor header is gated on an env that says so —
 * assuming it in a comment is exactly how the bypass got relocated instead of
 * closed:
 *   1. `x-vercel-forwarded-for` — read ONLY when `VERCEL` is set (Vercel sets
 *      it in its own runtime). Off-Vercel (nginx, self-hosted, k8s, localhost
 *      dev) nobody strips it, so it arrives verbatim from the client.
 *   2. `x-real-ip` — read ONLY when `TRUSTED_INGRESS_SETS_REAL_IP` is set.
 *      nginx populates it only where explicitly configured
 *      (`proxy_set_header X-Real-IP $remote_addr`); everywhere else it is
 *      just another client-authored header.
 *   3. `x-forwarded-for` LAST hop — the always-available fallback: the entry
 *      APPENDED by the ingress closest to us. Ingresses that append rather
 *      than overwrite leave the FIRST hop entirely client-supplied, so the
 *      first hop must never be used. This mirrors the hub's own
 *      `getClientIp`, which takes the same end of the same header for the
 *      same reason. On a deployment with NO trusted ingress at all this is
 *      still client-controllable — that is the floor of what a bare
 *      pass-through can know, and it is why the vendor headers above must
 *      not silently widen it.
 * Values are validated for IP shape before forwarding so a hostile header
 * can't inject CR/LF or extra header material into the upstream request.
 */
function visitorIpFrom(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const forwardedHops = forwardedFor ? forwardedFor.split(',') : [];
  const candidates = [
    // Gated: see the precedence note above. `process.env` is read per call
    // (not module-hoisted) so tests and edge runtimes see the live value.
    process.env.VERCEL ? (request.headers.get('x-vercel-forwarded-for') ?? '') : '',
    process.env.TRUSTED_INGRESS_SETS_REAL_IP ? (request.headers.get('x-real-ip') ?? '') : '',
    // LAST hop only — see the precedence note above.
    forwardedHops.length > 0 ? forwardedHops[forwardedHops.length - 1] : '',
  ];
  for (const raw of candidates) {
    const candidate = normalizeIpForBucketKey(raw);
    if (candidate) return candidate;
  }
  if (!warnedMissingVisitorIp) {
    warnedMissingVisitorIp = true;
    console.warn(
      '[guide-chat-proxy] no platform-set visitor IP found — guide rate limiting ' +
        'and conversation attribution will bucket every visitor together',
    );
  }
  return null;
}

/**
 * Proxy `request` to `${HUB_CHAT_BASE_URL}${upstreamPath}` (query string
 * forwarded), streaming the response straight back to the client.
 */
export async function proxyGuideChatToHub(request: Request, upstreamPath: string): Promise<Response> {
  const origin = hubOrigin();
  if (!origin) {
    return NextResponse.json({ error: 'Guide chat is not configured: HUB_CHAT_BASE_URL is unset' }, { status: 503 });
  }

  const { search } = new URL(request.url);
  const target = `${origin}${upstreamPath}${search}`;

  // Minimal upstream header set — content negotiation only, plus the service
  // identity pair. Deliberately NO cookie / authorization forwarding: app
  // session material must not leak to the hub.
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);
  headers.set('x-openframe-chat-source', 'openframe');
  const token = process.env.CHAT_SERVICE_TOKEN?.trim();
  if (token) {
    headers.set('x-chat-service-token', token);
  } else if (!warnedMissingServiceToken) {
    // Dev ergonomics keep the anonymous fallback, but in a deployed
    // environment it turns a missing env var into a confusing partial
    // outage (public sources answer, guide sources 401) with nothing in the
    // logs. Say it once.
    warnedMissingServiceToken = true;
    console.warn('[guide-chat-proxy] CHAT_SERVICE_TOKEN unset — forwarding anonymously');
  }

  // Visitor identity for rate-limit bucketing + conversation attribution.
  // Only meaningful alongside the service token (the hub gates `x-chat-ip`
  // on it), but harmless to send either way. See `visitorIpFrom`.
  const visitorIp = visitorIpFrom(request);
  if (visitorIp) headers.set('x-chat-ip', visitorIp);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      // Raw body pass-through; `duplex: 'half'` is required by undici when
      // streaming a request body (not yet in the DOM RequestInit type).
      ...(request.body ? ({ body: request.body, duplex: 'half' } as RequestInit) : {}),
      // Propagate client disconnects so an abandoned chat turn cancels the
      // upstream LLM stream instead of running to completion.
      signal: request.signal,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch (err) {
    if (request.signal.aborted) {
      // Client went away mid-request — nothing meaningful to answer.
      return new Response(null, { status: 499 });
    }
    console.error(`[guide-chat-proxy] upstream fetch failed for ${upstreamPath}:`, err);
    return NextResponse.json({ error: 'Upstream chat service unreachable' }, { status: 502 });
  }

  // Control path: upstream answered without a stream body (e.g. 204 / some
  // proxies on error). Return a JSON envelope so the client sees a clean
  // non-2xx instead of an empty stream.
  if (!upstream.body) {
    return NextResponse.json(
      { error: `Upstream chat service responded ${upstream.status} with no body` },
      { status: upstream.ok ? 502 : upstream.status },
    );
  }

  // Stream pass-through — success AND error bodies alike (the hub's JSON
  // error envelopes flow through with their original status + content-type).
  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get('content-type');
  if (upstreamType) responseHeaders.set('content-type', upstreamType);
  // Defeat CDN/proxy buffering so chat tokens render as they stream.
  responseHeaders.set('cache-control', 'no-store, no-transform');
  responseHeaders.set('x-accel-buffering', 'no');
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
