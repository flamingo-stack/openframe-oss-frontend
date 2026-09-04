# Route Registry (`src/lib/routes.ts`)

> **Single source of truth for every internal URL the app navigates to.**
> No page, component, hook, or table may hand-write an internal path string —
> all `router.push`/`router.replace`/`<Link href>`/`useSafeBack`/`redirect`
> targets are built through the `routes` object.

## Why it exists

Before the registry, ~80 call sites built URLs from raw string literals
(`router.push('/monitoring?tab=policies')`, `` `/devices/details/${id}` ``).
Every URL-scheme change (e.g. the dynamic-segment → `?id=` query-param
migration forced by the static-export build) meant grepping strings across
40+ files, and typos in paths or tab names surfaced only at runtime as 404s
or a silently wrong default tab.

The registry fixes that:

- **One edit per URL change.** A path lives in exactly one place; renaming a
  route is a one-line diff plus whatever the compiler flags.
- **Typed end to end.** Dynamic ids, query params, and tab names are
  type-checked. `routes.monitoring.root({ tab: 'policy' })` (typo) fails
  `tsc`; `` `/monitoring?tab=policy` `` did not.
- **Nullability surfaced.** Builders take `string | number` — passing a
  `string | null` id is a compile error, which has already caught real bugs
  where `null` was silently interpolated into a URL (`/details?id=null`).
- **Consistent query semantics.** All builders share one `withQuery()`
  helper: `undefined`/`null` params are dropped, values are URL-encoded via
  `URLSearchParams` (never call `encodeURIComponent` manually).

## Shape

```ts
import { routes } from '@/lib/routes';

// Static routes are plain strings:
routes.dashboard                    // '/dashboard'
routes.devices.list                 // '/devices'
routes.customers.new                // '/customers/new'

// Parametrized routes are functions; the options object is typed:
routes.customers.details(id)                          // /customers/details?id=<id>
routes.customers.details(id, { tab: 'tickets' })      // ...&tab=tickets
routes.devices.details(id, { action: 'runScript' })   // ...&action=runScript
routes.monitoring.root({ tab: 'policies' })           // /monitoring?tab=policies
routes.tickets.dialog(id, { tab: 'chat' })            // /tickets/dialog?id=<id>&tab=chat
```

Usage at call sites:

```tsx
router.push(routes.monitoring.policy(policy.id));
const handleBack = useSafeBack(routes.customers.list({ tab: 'archived' }));
<Link href={routes.settings.employees} />
<Button href={routes.devices.details(deviceId)} />
```

### Cross-cutting overlay params

A third form, for a panel that floats over *any* route rather than belonging to
one — currently only the Mingo chat drawer:

```ts
withMingoDialog('/devices/details?id=m-1', 'd-1')  // …&mingoDialog=d-1
withMingoDialog(currentUrl, null)                  // strips it
```

A `<NAME>_PARAM` constant plus a transformer that edits an existing URL, not an entry
in `routes` — these don't produce a URL, they amend the one already showing. Reuse or
generalize an existing transformer where you can; `withMingoDialog` is set/delete and
preserves the fragment and trailing slash, while the older `onboardingHintUrl` appends
blindly, so they are not yet interchangeable. This is **not** an exception to the
registry (the list at the bottom is about raw path *strings*): the transformer is still
a single owner encoding through `URLSearchParams`, exactly as `withQuery` does.

Rules for one:

- **Spelled exactly once, in one module.** `mingoDialog` lives in `routes.ts`
  (rationale on `MINGO_DIALOG_PARAM`); the pre-existing `SETUP_HINT_PARAM` /
  `onboardingHintUrl` pair lives in `onboarding-coach-marks.ts` beside the only
  feature that reads it. Either home is fine — two homes for one param is not.
- **Exactly one owner of the live value.** For `mingoDialog` that is
  `useMingoDialogUrlSync`, which mirrors drawer state into the URL and adopts it
  back. A resolver may hand the param in once as a redirect target and must then
  leave it alone; that is a handoff, not a second owner. Two owners turn a shared
  param into a race with no arbiter.
- **Other query writers must re-base on the live search string.** An overlay param is
  only as durable as the code that writes *around* it, and dropping it is not a
  cosmetic loss: the owner sees a param it was mirroring vanish and treats that as
  authoritative, so the drawer closes mid-conversation.
  `useApiParams.updateUrl` rebuilds from `useSearchParams()` and preserves it, as does
  the lib's `TabNavigation` urlSync. **Known non-conformers**, all currently unreached
  because every call site passes its own `onTabChange`: the `defaultHandleTabChange`
  fallbacks in `customers-tabs.tsx`, `monitoring-tabs.tsx` and `scripts-tabs.tsx`,
  which build `` `${pathname}?tab=${id}` `` from scratch. Wiring one up would drop the
  param — rebase it first.
  `useApiParams.resetParams` drops every param by design (`router.replace(pathname)`);
  it has no call site in `src/` today, but it is not compatible with an overlay param.
  There is also a narrow window in the other direction: writers that rebase on
  `useSearchParams()` read a value that lags a raw `history.replaceState` by one
  transition, so a write landing inside that window can drop the param anyway — and the
  owner reads a param it was mirroring going missing as authoritative, so it closes
  rather than re-stamping. Both directions land in the same place: don't write query
  strings from scratch.
- **Feed the transformer the live location** when the result goes through
  `history.replaceState` — see the `withMingoDialog` JSDoc for why.
- **Give it a canonical counterpart.** An overlay param rides the sharer's page,
  which is not what a notification or a copied link should carry — those need a
  page-independent URL that *resolves into* the overlay. For `mingoDialog` that is
  `mingoDialogLink()`: the same param on a fixed landing page.

## Tab ids (`TAB_IDS`)

Pages with a `?tab=` sub-view declare their allowed tab ids in `TAB_IDS`, and
union types are derived from it (`MonitoringTab`, `DeviceDetailTab`,
`SettingsTab`, …). This is the **source of truth** shared between the route
builders and the in-page `TabItem[]` arrays — the same string can't drift
between the link that targets a tab and the page that renders it.

In-page tab *state* (reading `?tab=`, switching tabs via `useApiParams` /
`TabNavigation` / `router.replace`) is not the registry's job — the registry
only produces the URLs that point *into* a tab from elsewhere.

## URL conventions encoded in the registry

These mirror the app-router constraints (static-export build):

- **No dynamic path segments.** Detail pages take the entity id as a query
  param, always named `id`: `/customers/details?id=…`, `/monitoring/policy?id=…`.
  This is a hard constraint, not a style preference. `output: 'export'` can only
  serve paths it prerendered, and the native shell answers every *un*prerendered
  path with the ROOT `index.html` (Capacitor's `CapacitorRouter` maps any
  extensionless path to `basePath + "/index.html"`) — so a nav to one fails its
  RSC-payload fetch, falls back to a hard navigation, and silently reloads the app
  at `/` instead of 404ing visibly. A `[slug]` route with a placeholder
  `generateStaticParams` does **not** buy an escape hatch: it prerenders the
  placeholder and nothing else.
  A dynamic segment is allowed *only* when its params are fully enumerable at
  build time — `/help-center/legal/[docType]` prerenders both of its values.
  The Help Center content routes are the one naming variation:
  `/help-center/onboarding-guides/detail?slug=…` and
  `/help-center/releases/detail?slug=…` use `slug`, not `id`, because the content
  endpoints resolve by slug only and 404 on an id.
- **Create pages are dedicated `/new` segments** (`/customers/new`,
  `/monitoring/policy/new`, `/scripts/new`), not an `?id=new` sentinel.
- **Multi-param routes** compose through the options object:
  `/devices/details?id=…&tab=overview&action=runScript`.

## Maintenance rules

When you add or change a page, tab, or any component that links somewhere:

1. **New page / route** → add its entry to `routes` first, then use
   `routes.*` at every call site. Never commit a raw internal path string.
2. **New `?tab=` view on a page** → add the tab id to `TAB_IDS`, derive the
   union if it's a new page, and reference the union (or `TAB_IDS`) from the
   page's `TabItem[]` definition instead of re-typing the literals.
3. **New query param on an existing route** → extend that builder's options
   object (typed — use a literal union when the values are enumerable, e.g.
   `action?: 'runScript'`).
4. **Renaming / restructuring a URL** → change it in `routes.ts` only; the
   compiler and a grep for the old literal confirm nothing else refers to it.
5. **Nullable ids** — builders intentionally reject `null | undefined`.
   Guard at the call site (`id ? routes.x.details(id) : routes.x.list`)
   rather than widening the parameter type.
6. **New overlay/panel that should be linkable** → a cross-cutting param, not a
   route: `<NAME>_PARAM` + `with<Name>()` in `routes.ts`, one writer, and a
   canonical `routes.*` entry that resolves into it. See *Cross-cutting overlay
   params* above.

**Known exceptions** (intentional raw strings — do not "fix"):
- `src/app/not-found.tsx` — the legacy-path redirect table maps *old* URLs
  to new ones; its keys are historical strings by design.
- `pathname.startsWith('/…')` active-state checks (sidebar, guards) compare
  against path prefixes, not full routes; literals are acceptable there.
- External URLs (`https://…`, `mailto:`) and API endpoints (`/api/…`) are
  out of scope — the registry covers internal *page* navigation only.
