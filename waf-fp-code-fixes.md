# Cloud Armor WAF false positives — code-level remediation

**Environment:** dev, GCP project `shared-j62b`
**Evidence window:** 2026-08-07 08:00–14:00 UTC (6 h), 48,255 LB requests
**Status of the WAF:** all OWASP CRS rules are `preview = true`. They cannot be flipped to enforce
until these fire cleanly — **31,729 requests (65.8% of all traffic) currently match a deny rule**,
and none of them are attacks. Every hit was reproduced back to legitimate application behaviour.

All percentages below are of those 31,729 preview DENY events.

> **Not covered here:** the Fleet orbit `Content-Type` family (6,710 events, 21.1%). Already fixed
> in `fleetmdm` commit `3a8439b6ec` "Content-Type Headers (#93)". It is unreleased — no tag
> contains it — and because the header is set endpoint-side the log census only clears as agents
> upgrade. Nothing to build; just ship it, and don't enforce `942340` until the census reads zero.

Everything below was verified against repo `HEAD` on 2026-08-07, because the logs reflect what is
**deployed**, not what is committed. All of it is still live.

---

## Summary

| # | Family | Events | % | Repo | Fix |
|---|--------|-------:|--:|------|-----|
| 1 | Marketing/analytics cookies on the app origin | 13,666 | 43.1% | GTM container `GTM-NR82B9WC`; Mux in `openframe-oss-lib` | Drop PostHog's cookie (one line of GTM config) |
| 2 | Raw GraphQL document in the `query` field | ~9,350 | 29.5% | `openframe-oss-frontend`, AI-agent service | Persisted queries |
| 3 | Bearer tokens / UUIDs in query strings | ~1,164 | 3.7% | `openframe-oss-lib`, `openframe-oss-tenant`, `openframe-oss-frontend` | Header or ticket — **also a security fix** |
| 4 | `access_token` JWT in a cookie | 291 | 0.9% | `openframe-oss-lib` | Opaque session id (token-handler) |
| 5 | Fleet agent inventory payloads | 153 | 0.5% | Fleet **app config** | Disable 2 detail queries → removes 69% of it |
| 6 | Chat message `content` | 102 | 0.3% | — | Scope the ruleset per endpoint, not a code change |
| 7 | `POST {}` with no `Content-Type` on `/chat/api/v1/dialogs` | 24 | 0.08% | chat client | One line — same bug as orbit |
| 8 | `PATCH`/`DELETE` blocked by method enforcement | 16 | 0.05% | `openframe-saas-tf` | Delete the rule |

### Evidence each is still unfixed at `HEAD`

| # | Check |
|---|---|
| 1 | Container `GTM-NR82B9WC` (served identically on auth **and** tenant hosts) calls `posthog.init` with no `persistence` and no `cross_subdomain_cookie` override, so both take library defaults — `localStorage+cookie` and cross-subdomain **true** → `Domain=.openframe.build`, 365 days |
| 2 | `relay.config.json` has no `persistConfig` key |
| 3 | `use-nats-dialog-subscription.ts:368` still calls `u.searchParams.set('authorization', …)`; `nats_connection_manager.rs:174,200` still format `?authorization={}`; `auth-api-client.ts:115,284,298,309` still build `?tenantId=` |
| 4 | `CookieService.java:27` still writes the raw JWT as the `access_token` cookie |
| 8 | `armor.tf:89` still declares `"205" = { rule_id = "methodenforcement-v422-stable" … }` |

---

## 1. Marketing & analytics cookies on the tenant app origin — 13,666 events (43.1%)

**Owner:** the Google Tag Manager container `GTM-NR82B9WC` (not a repo). One sub-item lives in
`flamingo-stack/openframe-oss-lib`.

This is not one fix. The four cookies have three different owners:

| Cookie | Events | % of all FPs | Actually set by |
|---|---:|--:|---|
| `ph_phc_uAXactV7usRLqxJkVE9NLEPBbGXS8SGr4Q8wxsk7jMRV_posthog` | 13,315 | 42.0% | PostHog SDK, loaded by GTM |
| `muxData` | 245 | 0.77% | **`@mux/mux-player-react`, bundled first-party** — not GTM |
| `_rdt_pn` / `_rdt_uuid` | 106 | 0.33% | Reddit pixel tag in the GTM container |

The PostHog cookie is a URL-encoded JSON blob; decoded it contains `,"distinct_id":` — comma,
quote, identifier, quote, colon — which CRS `942200` reads as a SQL operator pattern. The others
trip the *restricted SQL character anomaly* counters simply by carrying more punctuation than the
cookie budget allows.

### The cookie is domain-scoped, and that decides the whole fix

> **Correction.** An earlier draft of this section recommended gating `<GoogleTagManager />` off
> inside the authenticated app to remove "12,182 events (38.4% of all FPs)". **That does not
> work.** It assumed the cookie is set by whichever host loads GTM. It isn't — it is set on
> `.openframe.build` and sent to every tenant host regardless of what that host loads.

Three independent confirmations:

**1. The container's PostHog init overrides nothing.** Both `dev.openframe.build` and
`test-org.qa.openframe.build` serve the same container, and it calls:

```js
posthog.init("phc_uAXactV7usRLqxJkVE9NLEPBbGXS8SGr4Q8wxsk7jMRV", {
  api_host: "https://us.i.posthog.com",
  defaults: "2026-05-30",
  person_profiles: "identified_only",
  bootstrap: __phBootstrap
});
```

**2. Those defaults resolve to a shared cookie** (read from the shipped `array.js`):

```js
cross_subdomain_cookie: Hr(location),   //  Ur = ["herokuapp.com","vercel.app","netlify.app"]
persistence: "localStorage+cookie",     //  "openframe.build" ∉ Ur  →  TRUE
cookie_expiration: 365
```

and the domain is not guessed — the SDK *probes* it, shortest suffix first, stopping at the first
one the browser accepts: `.build` is a public suffix and is rejected, `.openframe.build` is
accepted. Result: `Domain=.openframe.build; path=/`, 365 days.

**3. Production logs show it arriving before the tenant app can run.** A real signup, IP
`83.175.189.105`:

```
11:50 – 13:54  dev.openframe.build      GET /api/tenant/availability  (x26 — subdomain picker)
13:56:21.647   mikhailtest.dev…build    GET /                    <-- 942200 on the PostHog cookie
13:56:22.027   mikhailtest.dev…build    GET /_next/static/…      <-- 942200
```

The tenant was **created during that session** and had never been visited. Its very first request —
the root document — already carries the cookie, and `<GoogleTagManager />` is
`strategy="afterInteractive"`, so PostHog on that host cannot have run yet.

Control: `of_oauth_*` (gateway-set, host-scoped) is **123/123 on auth hosts, 0 on tenant hosts** in
the same data. Host-scoped cookies visibly do not bleed here. This one does.

Since login happens only on the shared host (`NEXT_PUBLIC_SHARED_HOST_URL=https://dev.openframe.build`,
`saas-shared` mode) and the cookie lives a year, every user acquires it before ever reaching a
tenant. Gating the tenant-side mount changes nothing.

### Fix — two lines in the GTM container

**Shipped 2026-08-10, container version 19.** The kill list covers `.openframe.build`,
`.openframe.ai` and `.openframe.miami` plus the host-only variant.

```js
posthog.init('phc_uAX…', { …, persistence: 'localStorage' });
```

Removes the cookie on every surface: **13,315 events, 42.0% of all false positives**,
deterministically, with no repo change, no deploy and no browser cache cycle.

⚠️ **It does not delete cookies already issued.** `PostHogPersistence.remove()` clears only
`this.ii` — the *currently configured* store — and with `persistence:'localStorage'` that store
never touches `document.cookie`. Every browser that already has the cookie keeps sending it for up
to 365 days, and keeps tripping `942200`. So pair the init change with an explicit one-time kill in
the same container, ahead of `init`:

```js
document.cookie = 'ph_phc_uAXactV7usRLqxJkVE9NLEPBbGXS8SGr4Q8wxsk7jMRV_posthog=' +
                  '; domain=.openframe.build; path=/; max-age=0';
```

### On the PR #84 objection — the gap is now closed, and it flips the answer

The previous draft said not to touch persistence because `openframe-oss-frontend` PR #84
(`d83279a`, 2026-07-31) shipped cross-domain session continuity, then hedged that it could not
confirm the `#distinct_id` / `#session_id` hash survives the gateway redirect to the tenant host.

Checked against `HEAD`. The hash does not survive the hop — **it never leaves the browser.**

`appendPosthogHandoff()` (`posthog-events.ts:91`) has exactly one call site, `use-auth.ts:262`, and
its output is handed straight to `authApiClient.loginUrl()`, which at `auth-api-client.ts:292` does:

```ts
const keepRedirect = options?.authMobile || isAppShell() || !isSaasSharedMode();
const path = `${base}${…}${keepRedirect ? `&redirectTo=${redirectTo}` : ''}`;
```

On the shared auth host the mode **is** `saas-shared`, a browser is not an app shell, and
`loginWithSso()` passes no `authMobile` — so `keepRedirect === false` and `redirectTo` is dropped
from the URL entirely, taking the encoded `%23distinct_id=…&session_id=…` with it. That drop is
deliberate and documented in place: the shared auth host owns where a browser lands after login.

The three remaining configurations don't rescue it either:

| Configuration | `redirectTo` kept? | Handoff appended? | Net |
|---|---|---|---|
| `saas-shared`, browser | **no** — dropped at `:292` | yes, `use-auth.ts:262` | dropped |
| native shell (`isAppShell()`) | yes | **no** — `native-login.ts:61-63` builds its own `redirectTarget` | never written |
| `oss-tenant` / `saas-tenant` | yes | yes | auth and app share one origin — no hop to cross |

So `appendPosthogHandoff()` is dead code in every deployment, and `bootstrap: __phBootstrap` in the
container is reading a fragment nobody sends. The mechanism that actually carries a PostHog session
from `dev.openframe.build` to `<tenant>.dev.openframe.build` today is the `Domain=.openframe.build`
cookie — the one this fix removes.

**This does not change the recommendation. It changes the cost, and the cost has to be stated:**
`persistence: 'localStorage'` removes 42.0% of the false positives *and* ends cross-subdomain
continuity, because localStorage is origin-scoped and nothing else spans the two hosts. With
`person_profiles: 'identified_only'`, the pre-login anonymous session on the auth host stops
stitching to the post-login one on the tenant host; the identified user is still identified (the
`identify` push in `PostHogAnalyticsBridge` runs tenant-side), but the funnel loses its anonymous
head and the session recording restarts at the hop.

Two ways to take it, both legitimate — decide before publishing the container:

1. **Accept the loss.** The continuity has demonstrably never worked in SaaS since PR #84, so this
   removes an entry from the analytics backlog rather than a live capability. Ship item 1 as
   written and fix the handoff separately, on its own merits.
2. **Fix the handoff first, then switch persistence.** `redirectTo` is closed as a channel by
   design, so this needs a carrier the shared host is willing to forward — the gateway preserving
   the fragment on its final `Location`, or an explicit ids-in-hash hop it owns. That is gateway
   work, not a frontend one-liner, and it should not hold up a 42% reduction.

### The other two cookies are separate work

**`muxData` (245).** Mux is **not in the GTM container** — the container's only third parties are
PostHog, Reddit, Facebook, Hotjar, Google Ads/DoubleClick/AdSense, Ahrefs and YouTube. `muxData`
comes from `@mux/mux-player-react`, bundled first-party in
`openframe-oss-lib/openframe-frontend-core/src/components/features/video.tsx:34` and used by the
onboarding steps, `walkthrough-video.tsx` and help-center releases. The logs agree: 233/233 hits on
tenant hosts, **zero** on auth hosts. Fix is `disable-cookies` on the player, and nothing in this
section touches it.

**`_rdt_pn` / `_rdt_uuid` (106).** Reddit's tag, and its cookie is registrable-domain scoped too
(observed on both auth and tenant hosts), so gating the mount won't reliably clear it either.
Either drop the Reddit tag from the container or cover it with an exclusion.

### The privacy problem is real — but do NOT gate the mount in code

`src/app/layout.tsx:122` mounts `<GoogleTagManager />` unconditionally, so Facebook pixel, Reddit
pixel, Hotjar, Google Ads, DoubleClick and AdSense all load **inside the authenticated MSP
product**, on pages listing customer device inventories. That is worth fixing on privacy and
compliance grounds. It is not a WAF fix, and it should not be counted as one.

> **Correction.** An earlier draft prescribed a one-line app-mode gate in the root layout:
>
> ```tsx
> {isSaasSharedMode() && <GoogleTagManager />}   // do not ship this
> ```
>
> **It throws out the product analytics with the ad tech.** This app bundles no `posthog-js` —
> `posthog-events.ts:5` states it outright, and the container is the only thing that loads the SDK.
> Gating the mount to `saas-shared` means PostHog does not load on the tenant host **at all**: no
> pageviews, no session recording, no `identify`, nothing from inside the product. The
> `dataLayer.push` calls in `PostHogAnalyticsBridge` would write into an array nobody reads.
> The gate removes seven third parties and the one first-party tool the company actually uses.

The separation wanted here is per-tag, not per-mount, and it belongs in the container: give the
Facebook, Reddit, Hotjar, Google Ads, DoubleClick and AdSense tags a trigger condition on **Page
Hostname** so they fire only on the marketing and auth hosts, and leave the PostHog tag firing
everywhere. Same privacy outcome, no code change, and product analytics survives.

⚠️ Check the funnel either way. The container listens for exactly two dataLayer events —
`openframe_registration` and `signup_completed` — and `signup_completed` is pushed from
`PostHogAnalyticsBridge` in the root layout, i.e. on the *tenant* host. Gating GTM there drops it
unless the trigger moves. (Separately, and independent of the WAF: `markPendingSignup()`
(`posthog-events.ts:62`) writes **sessionStorage** on the auth host, while `consumePendingSignup()`
reads it from `PostHogAnalyticsBridge` on the tenant host — different origins, so in SaaS that read
can never return true and `signup_completed` never fires. Confirmed at `HEAD`, and it is the same
origin-scoping mistake as the handoff above: the two hosts share nothing but the cookie. Both are
already broken today, so neither is a regression caused by item 1 — but both stay broken after it.)

**Interim:** the `request_cookie ENDS_WITH "_posthog"` exclusion still ships today and is still the
right bridge until the container change lands and the legacy cookies age out.

---

## 2. Raw GraphQL documents in the `query` field — ~9,350 events (29.5%)

**Repos:** `flamingo-stack/openframe-oss-frontend`, the `openframe-saas-ai-agent` service

Rules `942290`/`942430`/`942431`/`942432` on `ARG_VALUES` field `query`:

```
POST /chat/graphql   (saas-ai-agent)   ~4,600
POST /api/graphql    (Relay)           ~1,600
```

Cloud Armor parsed these bodies correctly and extracted `query`. The problem is the content: raw
GraphQL document text. `($id: ID!) {`, `$filter`, `$or`, `$first`, `$sort`, `$in`,
`{\n unreadCounts` — braces, `$`-prefixed variables and Mongo-style operator names are exactly
what the SQLi rules score on. No amount of tuning makes GraphQL text stop looking like this; the
fix is to stop sending the document.

### Fix — persisted queries

**`/api/graphql` (Relay).** Already uses Relay (`relay.config.json`,
`src/lib/relay/environment.ts:26`), which supports this natively. Add:

```json
{ "persistConfig": { "file": "./persisted-queries.json" } }
```

The compiler emits a query map at build time; the client sends `{"doc_id": "<hash>", "variables":
{…}}`. Nothing SQL-shaped crosses the WAF.

**`/chat/graphql` (saas-ai-agent).** Enable Automatic Persisted Queries on both ends — the client
sends `{"extensions":{"persistedQuery":{"version":1,"sha256Hash":"<hash>"}}}`. Note APQ's
cache-miss fallback re-sends the full document and would still trip the WAF, so pair it with
**allowlist-only** mode in production (reject unknown hashes rather than accepting the document).
That closes the FP *and* removes arbitrary-query execution as an attack surface.

Persisted queries also cut request size on every GraphQL call.

⚠️ **Neither end supports this today — the frontend line is not a standalone change.** Checked at
`HEAD`: `relay.config.json` has no `persistConfig`, and nothing in `openframe-api-service-core` or
the ai-agent service mentions `documentId`, `doc_id` or `persistedQuery`. Adding `persistConfig`
alone makes Relay send `{"doc_id": …}` to a server that only knows how to read `query` — every
`/api/graphql` call 400s. The server-side query-map lookup has to land **first**, or both ship
together behind a flag. Sequencing these backwards takes the whole app down, which is why items 8
and 9 are the two genuinely multi-week entries in the work order.

### Also: service-to-service traffic is hairpinning

2,428 `/chat/graphql` requests come from `Apache-HttpClient/4.5.13 (Java/21)`:

```
1863  35.223.208.146   asn=15169 (Google)   <-- a pod egressing via Cloud NAT
2153  101.57.165.170   asn=210278 (IT)      <-- developer / test machine
```

An in-cluster service is calling the AI-agent GraphQL API by going out to the public internet and
back in through the external LB — paying NAT, egress, full Armor evaluation and TLS twice. It
should use in-cluster service DNS. That removes the traffic from WAF inspection entirely, and is
right regardless of the WAF.

### Bridge if persisted queries can't be scheduled soon

`advanced_options_config` supports `json_parsing = "STANDARD_WITH_GRAPHQL"`, which parses GraphQL
bodies structurally. One line of Terraform. A mitigation, not a fix — treat it as a bridge.

---

## 3. Bearer tokens and UUIDs in query strings — ~1,164 events (3.7%)

**This is a security finding independent of the WAF.** JWTs in query strings are written to Armor
and LB request logs in plaintext, land in browser history, and leak via `Referer`.

Rules `942431`/`942432` fire on the `-`/`_`/`.` density of base64url JWTs and UUIDs.

| Param | Events | Where |
|---|---:|---|
| `authorization` (`/ws/nats-api`, `/ws/nats`) | 634 | below |
| `tenantId` (`/oauth/login`, `/oauth/refresh`) | 192 | `openframe-oss-frontend` |
| `id` (`/tools/meshcentral-server/api/deviceStatus`) | 73 | `openframe-oss-frontend` |
| `refresh_token`, `client_id`, `code_challenge`, `_csrf`, `api_version`, `email` | ~265 | mixed |

### 3a. WebSocket tokens — the important one

`flamingo-stack/openframe-oss-lib` —
`openframe-frontend-core/src/components/chat/hooks/use-nats-dialog-subscription.ts:355-372`:

```ts
export function buildNatsWsUrl(apiBaseUrl: string, options?: {…}): string {
  const path = options?.source === 'dashboard' ? '/ws/nats-api' : '/ws/nats'
  const u = new URL(path, apiBaseUrl)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  if (options?.includeAuthParam && options?.token) {
    u.searchParams.set('authorization', options.token)   // <-- JWT into the query string
  }
  return u.toString()
}
```

`flamingo-stack/openframe-oss-tenant` —
`clients/openframe-client/src/services/nats_connection_manager.rs:174` and `:200`:

```rust
let new_url = format!("{}/ws/nats?authorization={}", nats_server_url, token);
```

**Fix.** The browser `WebSocket` constructor can't set headers, which is why the param exists. Two
standard workarounds:

1. **Short-lived ticket** — client calls an authenticated `POST /ws/ticket`, gets a single-use
   ~30-second opaque token, connects with `?ticket=<opaque>`. Opaque random strings match no SQLi
   signature, and a leaked log line is worthless 30 seconds later.
2. **`Sec-WebSocket-Protocol`** — pass the token as a subprotocol value; the gateway reads it off
   the handshake. Header, not URL, so it never reaches request logs.

> **Correction — the Rust agent is not the cheap half.** An earlier draft said it is "not
> browser-constrained and should just send `Authorization: Bearer` on the upgrade. Do that one
> first — cheaper half." The agent's NATS client makes that harder than the browser's, not easier.
>
> The good news: the pinned fork already supports handshake headers. `Cargo.toml:79` points
> `async-nats` at `flamingo-stack/nats.rs` with `features = ["websockets"]`, and
> `nats_connection_manager.rs` already calls `.custom_header("X-MACHINE-ID", &machine_id)`.
>
> The blocker: those headers are **static**. `custom_header()` writes into a
> `handshake_headers` map on `ConnectOptions`, fixed once at connect time. Token rotation is what
> the query param is actually carrying — `auth_url_callback` fires on every reconnect and returns a
> **freshly built URL** with a new token (`nats_connection_manager.rs:174`). Move the token into a
> static header and the first post-expiry reconnect authenticates with a stale credential and 401s
> forever.
>
> So this needs `handshake_headers` to become refreshable per reconnect — a change in the
> `nats.rs` fork, not in the agent — plus the gateway reading the header. It belongs **with** item
> 7, not ahead of it, and both should land behind a transition window where the query param is
> still accepted.

Gateway side is `openframe-oss-lib/openframe-gateway-service-core`
(`WebSocketServiceSecurityDecorator`, which already maps `/ws/nats-api` → `nats-api`). Keep the
query param accepted during the transition.

Related: this is the same handshake path as the existing `/ws/nats-api` 401-storm and
client-gateway websocket-storm issues. Worth looking at all three together.

### 3b. `tenantId` and `id`

`flamingo-stack/openframe-oss-frontend`: `src/lib/auth-api-client.ts:115,284,298,309`;
`src/lib/token-refresh-manager.ts:19`; `src/lib/meshcentral/meshcentral-api.ts:20`
(`deviceStatus?id={nodeId}`); `use-live-campaign.ts:370`.

`tenantId` is a plain UUID and only fires because the anomaly rules count hyphens — lowest
priority here. `meshcentral-tunnel.ts:64` and `meshcentral-control.ts:41` append
`&authorization=<token>` and belong with 3a.

**No part of 3b is a frontend-only change**, despite every listed file living in the frontend.
`tenantId` goes to gateway BFF endpoints (`/oauth/login`, `/oauth/refresh`) that read it off the
query string — moving it to a header means changing what those endpoints parse. And
`deviceStatus?id=` is MeshCentral's own API shape, proxied through `/tools/meshcentral-server`;
the frontend cannot rename a parameter the upstream product defines. Each one needs its server
counterpart, so 3b rides along with items 5 and 7 rather than being pickable on its own.

---

## 4. `access_token` JWT cookie — 291 events (0.9%)

**Repo:** `flamingo-stack/openframe-oss-lib`

Rules `942420`/`942421` are cumulative special-character counters on cookie *values*. A JWT is
three base64url segments joined by dots — dense in `-`, `_`, `.` — so it blows the budget on every
request carrying it. You can't make a JWT contain fewer special characters. You can stop putting
one in the cookie.

The code is already shaped for it:

| File | Role today |
|---|---|
| `openframe-security-core/.../cookie/CookieService.java:27` | defines `ACCESS_TOKEN_COOKIE`, writes the raw JWT |
| `openframe-security-oauth/.../OAuthBffController.java:177,190` | `addAuthCookies(headers, tokens.access_token(), tokens.refresh_token())` |
| `openframe-gateway-service-core/.../AddAuthorizationHeaderFilter.java:86` | reads it back, converts to an `Authorization` header |

That is already a BFF — it just stores the bearer token rather than a handle to it. The
**token-handler pattern** completes it: issue an opaque random session id (32 chars of
`[A-Za-z0-9]`), keep the real tokens server-side in Redis (`openframe-data-redis` is already a
dependency), resolve id → token inside `AddAuthorizationHeaderFilter` — the exact seam that
already does the cookie → header translation.

An opaque alphanumeric id has **zero** special characters, so those rules can never fire on it.
Three files plus a session store, and worth doing on its own merits:

- sessions become instantly revocable (today a leaked JWT is valid until expiry);
- the token stops being readable by anything that can read the cookie;
- the cookie shrinks from ~800 bytes to ~32 on every request.

Same treatment for `refresh_token`.

**Interim:** multi-service change, so ship a `request_cookie EQUALS access_token` exclusion now and
remove it when the session store lands. Sequencing, not a substitute.

---

## 5. Fleet agent inventory payloads — 153 events (0.5%)

**Fix lives in Fleet app configuration, not in code.** I previously described this family as
"osquery SQL, unfixable without forking the protocol." That was wrong on both counts — only 10% of
it is SQL, and most of the rest comes from two detail queries that Fleet lets you turn off.

Actual contents, from the VERBOSE `matchedFieldName`/`matchedFieldValue`:

| Source | Events | % | Example matched value |
|---|---:|--:|---|
| `certificates_darwin.*.subject` / `.common_name` | 90 | 59% | `=com.apple.kerbe`, `=US/ST=Californi`, `local (` |
| `data.0.hostIdentifier` (osquery log envelope) | 21 | 14% | `-728A-`, `-C70D-` |
| `scheduled_query_stats.*.query` | 16 | 10% | `SELECT hot_fix_i`, `WHERE platform =` |
| `software_windows.*.version` | 12 | 8% | `-07-29 07:35:56.` |
| `host_details.system_info.cpu_brand` | 4 | 3% | `(R) Xeon(R) CPU ` |
| `fleet_distributed_query_*.0.notnull` | 3 | 2% | `notnull` |

These bodies parse correctly (`PARSED=153, RAW=0`) — this is not a mis-parse. The values really do
contain X.509 distinguished names, timestamps, CPU brand strings and, in one case, SQL.

### Fix — disable two detail queries you may not need

Fleet supports `features.detail_query_overrides` in app config
(`server/fleet/app.go:1402`, `DetailQueryOverrides map[string]*string`); setting a query's value to
null disables it. And `scheduled_query_stats` is separately gated by the server-side
`EnableScheduledQueryStats` config (`server/service/osquery_utils/queries.go:3427`).

```yaml
features:
  detail_query_overrides:
    certificates_darwin: null     # removes 90 events (59%)
```
plus `EnableScheduledQueryStats: false` — removes 16 more (10%).

**Together that is 69% of this family, with no code change and no protocol fork.**

⚠️ **This is a product decision, not a WAF decision.** Turning these off means losing macOS
certificate inventory and scheduled-query performance stats. Check whether the product surfaces
either before disabling — *don't collect what you don't use* is the right principle, but only if
it's genuinely unused. `certificates_darwin` is defined at
`server/service/osquery_utils/queries.go:838` if you want to see what it gathers.

### The remainder (~31%) genuinely isn't fixable

`hostIdentifier` UUIDs, Windows software version timestamps, `(R) Xeon(R) CPU` — that is hardware
and software inventory, which is the entire point of the product. The only way to change its shape
is to re-encode the osquery↔Fleet wire format on both ends, forking a protocol owned upstream.
Not worth it for 47 events.

For those, prefer scoping over exclusion: these are machine-to-machine endpoints authenticated by
node key, and nothing in that path builds SQL from the payload. Give the agent paths
(`/api/v1/osquery/`, `/api/fleet/orbit/`) their own narrower rule band evaluated ahead of the
general WAF band, rather than punching a field-shaped hole in the whole client policy.

---

## 6. Chat message `content` — 102 events (0.3%)

**No code change. But not for the reason I first gave** — I called this "user-authored prose" and
in dev it mostly isn't.

| What it actually is | Events | Example matched value |
|---|---:|---|
| **E2E / QA test harness strings** | 67 | `:\Temp\e2e-`, `"E2E-`, `-e2e-`, `"QA-UI-01 ps for`, `"hostname2"`, `"qa@` |
| Real human prose | ~23 | `фран`/`санс`/`скаж` (Cyrillic), ` #187 `/` #179 ` (ticket refs), `Reboot `, `hour (`, `: what'` |
| Windows paths in messages | 4 | `:\Program Files\` |

So two-thirds of this family is automated test traffic that wouldn't exist in production, and the
genuine production-shaped signal is roughly **23 events per 6 hours**. It is the smallest real
problem in this document.

The instructive part is *which rules* fire on the human prose:

- `932236` is an **RCE** rule matching the English word `Reboot `. An RCE ruleset over a prose
  field will always false-positive — those rules match shell command names.
- `942460` is a meta-character anomaly rule matching **Cyrillic text**.
- `942440` matches ` #187 ` because `#` opens a MySQL comment. Every ticket reference looks like
  this.

That is the same structural problem as §8: a ruleset pointed at input it can never be right about.
The fix is **scoping the rule band for `/chat/api/`**, not a field exclusion and definitely not
encoding the field.

For completeness — a code change *would* suppress it (base64-encode `content` on the wire, decode
server-side). Don't. It defeats log readability and request tooling, breaks content-type
semantics, and has to be repeated for every free-text field the product ever adds. Users will keep
typing `#`, `--`, quotes and Cyrillic; none of it is concatenated into a query. Injection defence
for user-authored content belongs at the persistence layer, where data and code can actually be
told apart.

*(I did not pin down the ai-agent's storage engine — `MessageController.java:36` delegates and the
service declares no repositories of its own. Confirm the write path is parameterised rather than
assuming it.)*

---

## 7. `POST {}` — an empty JSON body — 24 events (0.08%)

**Fixed.** `openframe-oss-tenant` + `openframe-saas-tenant`, `waf-fp-remediation`.

On `POST /chat/api/v1/dialogs`, Cloud Armor reports `matchedFieldType: ARG_NAMES`,
`matchedFieldName: {}` — the entire raw body as a single argument name — and CRS `942432` scores
its two braces as special characters.

> **Correction.** An earlier draft called this "the same bug as the orbit family" and prescribed
> setting `Content-Type: application/json`, reasoning that Armor only reports a raw body when the
> JSON parser doesn't engage. **The header was never missing.** The client is
> `clients/openframe-chat/src/services/chatApiService.ts` (byte-identical in both tenant repos), and
> its `getHeaders()` has always sent `Content-Type: application/json`. Every other candidate checked
> clean too: this app's `apiClient` sets it centrally (`api-client.ts:129`), and the E2E suite gets
> it from `RequestSpecHelper.prebuildRequestSpec()`.

The real cause is the body itself. `createDialog()` posted `JSON.stringify({})` — an object with no
fields. Armor's JSON parser engages fine; there is simply nothing in it to extract, so it falls
back to scoring the raw body, and a raw body of `{}` is two special characters and nothing else.
A parsed empty object and an unparsed body are indistinguishable in the logs, which is what made
the header the obvious-looking culprit.

Fix — send the field the server would have defaulted to anyway:

```ts
body: JSON.stringify({ agentType: 'CLIENT' }),
```

`CreateDialogRequest` declares `private AgentType agentType = AgentType.CLIENT`, so this is
semantically identical to `{}` and changes no behaviour — it just gives the parser a field.

**Generalise the right lesson.** "Grep for missing `Content-Type` across every HTTP client" was
the wrong follow-up. The one worth doing is: *any request whose body is an empty JSON object will
trip this*, regardless of headers. `POST {}` as a "create with defaults" idiom is common, and each
occurrence is one field away from being invisible to the WAF.

---

## 8. Method enforcement is incompatible with the API — 16 events (0.05%)

**Repo:** `flamingo-stack/openframe-saas-tf`, `openframe-saas/dev/services/03-shared/armor.tf:89`

Rule `911100` (`methodenforcement-v422-stable`, user policy priority 205) denied legitimate verbs:

```
PATCH   /api/devices/{uuid}          (5)
PATCH   /api/organizations/{uuid}    (2)
DELETE  /tools/fleetmdm-server/api/v1/…   (2)
```

The platform is a REST API; these verbs are core to it. The rule set only makes sense for services
with a fixed, narrow verb surface. Remove `methodenforcement-v422-stable` from `user_waf_rules` —
it will never be enforceable here, and leaving it in preview generates noise that hides signal.

Also observed and harmless: `921230-protocolattack` (7 events) — a `Range: bytes=` header from
link-preview bots on `/dashboard`, `/robots.txt`, `/auth`, `/settings/billing-usage`.
`942370` (1) on a GraphQL `query`, `942210` (1) on a `_csrf` token containing the substring `AnD`.

---

## Suggested order

> **Two numberings, and they don't line up.** The Summary table above numbers *families* (§1–§8,
> and the section headings follow it); this table numbers *work items*. Order 3 is family §7, order
> 2 is family §8. The `§` column below is the mapping — cite families as "§n", work as "item n".

Status as of 2026-08-10. Code changes sit on a `waf-fp-remediation` branch in each repo.

| Order | Change | § | Repo | Status | FP reduction |
|---|---|---|---|---|---|
| 1 | PostHog `persistence: 'localStorage'` + one-time cookie kill *(ends cross-subdomain continuity — §1)* | §1 | GTM `GTM-NR82B9WC` | **shipped** — container v19, 2026-08-10 | 42.0% |
| 2 | Delete the `methodenforcement` rule at p205 | §8 | `openframe-saas-tf` | blocked — repo not checked out locally | 0.05% |
| 3 | Non-empty body on the chat dialogs POST | §7 | `openframe-oss-tenant`, `openframe-saas-tenant` | **done** — branch, both copies | 0.08% |
| 4 | `disableCookies` on the Mux player | §1 | `openframe-oss-lib` | **done** — branch | 0.77% |
| 5 | Agent sends `Authorization` header on WS upgrade | §3a | `nats.rs` fork + gateway | blocked — static handshake headers, see §3a | ~1% |
| 6 | Disable `certificates_darwin` + `scheduled_query_stats` *(if unused)* | §5 | Fleet app config | product decision, not code | 0.33% |
| 7 | WS ticket / subprotocol for browser clients | §3a | `openframe-oss-lib` + gateway | needs gateway | ~1% |
| 8 | Relay persisted queries (`/api/graphql`) | §2 | frontend **+ api service** | needs server-side query map first | ~5% |
| 9 | APQ allowlist for `/chat/graphql` | §2 | AI-agent + `openframe-oss-lib` | needs both ends | ~24% |
| 10 | Route internal `/chat/graphql` calls in-cluster | §2 | Java caller | not started | — |
| 11 | Opaque session id instead of JWT in `access_token` cookie | §4 | `openframe-oss-lib` | not started, multi-service | 0.9% |
| 12 | Scoped rule bands for `/chat/api/` and agent paths + residual exclusions | §6, §5 | `openframe-saas-tf` | blocked with item 2 | ~1% |
| — | Per-tag hostname triggers instead of gating the GTM mount — **privacy, not WAF** | §1 | GTM container | not started — do **not** gate in code, see §1 | 0% |

**Shipped or ready: 42.85%** (items 1, 3, 4). Everything remaining is blocked on a repo, a
backend, or a product decision — none of it is frontend work that simply hasn't been done.

Not in this table: **§3b** (`tenantId` / `id` UUIDs in query strings, ~265 events) — lowest priority
of everything here, and it rides along with items 5 and 7 when those touch the same clients.

Items 1–4 are **42.9%** for roughly an afternoon of work, and item 1 alone is most of it. Items 8–9
are the other large block and the only genuinely multi-week items on the list.

**Watch the deployment lag.** Item 1 takes effect on the next container publish, but only for
cookies not already issued — hence the explicit kill line; without it this family decays over 365
days instead of dropping. Item 5 ships inside an agent on customer endpoints, so its census clears
only as hosts upgrade — same as the already-fixed orbit family. Items 4, 8 and 9 ship in the
frontend and take effect on the next deploy plus a browser cache cycle. Judge each family by its
own census going to zero, not by the merge date.

---

## Verification

After each change, confirm the family has gone quiet before moving on:

```bash
gcloud logging read \
  'resource.type="http_load_balancer" AND
   jsonPayload.previewSecurityPolicy.outcome="DENY" AND
   timestamp>="<T>"' \
  --project=shared-j62b --format=json --limit=20000 \
| python3 -c '
import json,sys,collections
c=collections.Counter()
for e in json.load(sys.stdin):
    p=e["jsonPayload"]["previewSecurityPolicy"]
    c[(",".join(p.get("preconfiguredExprIds",[])), p.get("matchedFieldName","")[:60])]+=1
for k,v in c.most_common(30): print(v,k)'
```

`matchedFieldName` is the field to watch. It is what any exclusion has to target, and it tells you
whether Cloud Armor parsed the body (a field name like `orbit_node_key` or `content`) or gave up
on it (a field name that is the whole raw body, starting with `{`). `matchedFieldValue` tells you
*why* a rule fired — it is what corrected §5 and §6 in this document.

Flip rules from `preview = true` to enforcing **per rule ID**, not all at once, and only once that
ID reads zero over a full business day.

---

## One note outside this scope

The Grafana backend service `gkegw1-wy3x-platform-grafana-80-zk8ekcr78vbc` has **no Cloud Armor
policy attached at all**, as do the `serve404` / `serve500` backends. Unrelated to false
positives, but part of the estate is not behind the WAF at all — worth tracking separately.
