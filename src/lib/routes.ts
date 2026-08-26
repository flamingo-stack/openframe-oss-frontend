/**
 * Centralized, typed registry of every internal app route.
 *
 * Single source of truth for navigation: instead of hand-writing path strings
 * (`router.push('/monitoring?tab=policies')`) scattered across the app, build
 * them here so paths, dynamic ids, and query params (tabs, filters) are all
 * type-checked.
 *
 * Static routes are plain strings; routes that take parameters are functions
 * whose options object is typed. Tab ids live in {@link TAB_IDS} and are the
 * source of truth shared with the in-page tab-component arrays.
 *
 *   router.push(routes.monitoring.root({ tab: 'policies' }));
 *   router.push(routes.customers.details(id, { tab: 'tickets' }));
 *   <Link href={routes.devices.details(deviceId)} />
 *
 * This module owns how URLs are *produced* — in-page tab state (useApiParams /
 * TabNavigation) is unchanged. URL/path values themselves are not changing, so
 * existing bookmarks stay valid.
 */

// --------------------------------------------------------------------------
// Tab ids (single source of truth, shared with the tab-component arrays)
// --------------------------------------------------------------------------

export const TAB_IDS = {
  customersList: ['active', 'archived'],
  customerDetails: [
    'devices',
    'tickets',
    'logs',
    'worktime',
    'details',
    'custom-ai-assistant',
    'customer-ai-guardrails',
  ],
  customerEdit: ['details', 'ai-configuration', 'guardrails'],
  deviceDetails: [
    'overview',
    'vulnerabilities',
    'policies',
    'queries',
    'security',
    'agents',
    'tickets',
    'hardware',
    'os',
    'network',
    'users',
    'software',
  ],
  scriptDetails: ['details', 'executions'],
  scheduleDetails: ['scripts', 'devices', 'runs', 'executions'],
  monitoring: ['policies', 'queries'],
  settings: ['ai-settings', 'architecture', 'company-and-users', 'api-keys', 'sso-configuration', 'profile'],
  aiSettings: ['mingo', 'customer', 'guardrails'],
  notifications: ['history'],
} as const;

export type CustomerListTab = (typeof TAB_IDS.customersList)[number];
export type CustomerDetailTab = (typeof TAB_IDS.customerDetails)[number];
export type CustomerEditTab = (typeof TAB_IDS.customerEdit)[number];
export type DeviceDetailTab = (typeof TAB_IDS.deviceDetails)[number];
export type ScriptDetailTab = (typeof TAB_IDS.scriptDetails)[number];
export type ScheduleDetailTab = (typeof TAB_IDS.scheduleDetails)[number];
export type MonitoringTab = (typeof TAB_IDS.monitoring)[number];
export type SettingsTab = (typeof TAB_IDS.settings)[number];
export type AiSettingsTab = (typeof TAB_IDS.aiSettings)[number];
export type NotificationsTab = (typeof TAB_IDS.notifications)[number];

/** Legal documents the Help Center `[docType]` route prerenders. */
export type HelpCenterLegalDoc = 'privacy' | 'terms';

// --------------------------------------------------------------------------
// Query-string helper
// --------------------------------------------------------------------------

type QueryValue = string | number | boolean | undefined | null;

/**
 * Append a typed query object to a base path. Skips `undefined`/`null` values
 * and URL-encodes the rest, so every parametrized route shares identical query
 * semantics.
 */
function withQuery(base: string, query?: Record<string, QueryValue>): string {
  if (!query) return base;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) qs.set(key, String(value));
  }
  const serialized = qs.toString();
  return serialized ? `${base}?${serialized}` : base;
}

// --------------------------------------------------------------------------
// Mingo dialog params
// --------------------------------------------------------------------------

/**
 * Query param carrying the dialog id on the canonical `/mingo` route.
 *
 * Shared with `MingoPage`, which reads it back, because the two halves are one wire
 * contract: rename it on the producing side alone and every push and OS-toast deep
 * link silently redirects to a bare dashboard with the id dropped — no compile
 * error, and the notification tests only pin the half that builds the URL.
 *
 * Distinct from {@link MINGO_DIALOG_PARAM} on purpose: this one names the SHARE URL's
 * id, that one the live drawer state. `/mingo` reads this and writes that, and one
 * shared name would make the handoff indistinguishable from a loop.
 */
export const MINGO_CANONICAL_DIALOG_PARAM = 'dialogId';

/**
 * Query param naming the dialog open in the Mingo chat drawer.
 *
 * Not an entry in {@link routes} because it belongs to no single route: the drawer
 * floats over whatever page is showing, so this rides the CURRENT URL rather than
 * producing one. See ROUTES.md § *Cross-cutting overlay params* for the policy.
 */
export const MINGO_DIALOG_PARAM = 'mingoDialog';

/**
 * Add (or, with `null`, remove) {@link MINGO_DIALOG_PARAM} on an app-relative URL,
 * preserving the path, the fragment, and the values of other params (which are
 * re-serialized through `URLSearchParams`, so their encoding may be normalized).
 *
 * A caller writing the result straight through `history.replaceState` must feed it
 * the LIVE location (`pathname + search + hash`), never a `routes.*` constant:
 * nothing normalizes it afterwards, and `trailingSlash: true` means a slash-less path
 * is one the static export's file host cannot resolve on reload. Passing a `routes.*`
 * value is fine when the result goes through `router.replace`, which does normalize.
 */
export function withMingoDialog(url: string, dialogId: string | null): string {
  const hashAt = url.indexOf('#');
  const hash = hashAt === -1 ? '' : url.slice(hashAt);
  const withoutHash = hashAt === -1 ? url : url.slice(0, hashAt);

  const queryAt = withoutHash.indexOf('?');
  const path = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  const params = new URLSearchParams(queryAt === -1 ? '' : withoutHash.slice(queryAt + 1));

  if (dialogId === null) {
    params.delete(MINGO_DIALOG_PARAM);
  } else {
    params.set(MINGO_DIALOG_PARAM, dialogId);
  }

  const serialized = params.toString();
  return `${path}${serialized ? `?${serialized}` : ''}${hash}`;
}

// --------------------------------------------------------------------------
// The route registry
// --------------------------------------------------------------------------

export const routes = {
  root: '/',
  dashboard: '/dashboard',
  onboarding: '/onboarding',
  helpCenter: {
    root: '/help-center',
    onboardingGuides: '/help-center/onboarding-guides',
    // Content detail pages follow the app-wide query-param convention rather than
    // a `[slug]` segment. Guide/release slugs are CMS content, so `output: 'export'`
    // cannot prerender them, and the native shell answers EVERY unprerendered path
    // with the root `index.html` — a `/onboarding-guides/<slug>` nav failed its RSC
    // fetch and hard-reloaded the app at `/`. A prerendered path + `?slug=` keeps it
    // a soft-nav. See help-center-content-href.ts, which maps content cards here.
    onboardingGuide: (slug: string) => withQuery('/help-center/onboarding-guides/detail', { slug }),
    roadmap: '/help-center/roadmap',
    releases: '/help-center/releases',
    release: (slug: string) => withQuery('/help-center/releases/detail', { slug }),
    bugFixesAndEnhancements: '/help-center/bug-fixes-and-enhancements',
    tickets: '/help-center/tickets',
    faqs: '/help-center/faqs',
    knowledgeBase: '/help-center/knowledge-base',
    // `[docType]` is enumerable (see the route's `generateStaticParams`), so the
    // literal union is the typed guard ROUTES.md asks for over a bare `string`.
    legal: (docType: HelpCenterLegalDoc) => `/help-center/legal/${docType}`,
  },
  worktime: '/worktime',

  /**
   * Standalone post-deletion page. Deliberately NOT under `/auth`: saas-tenant
   * (web) blocks the whole `/auth` subtree, and the page must be reachable in
   * every tenant mode right after the session is destroyed.
   */
  accountDeleted: '/account-deleted',

  /**
   * Public account-deletion instructions. Google Play requires a deletion
   * request URL reachable from a browser WITHOUT installing the app, and it
   * has to resolve for a visitor who cannot sign in (left the MSP, disabled by
   * an admin, lost the password) — so this sits outside `(app)` and `(auth)`
   * and assumes no session. The canonical URL is on the SHARED host
   * (`NEXT_PUBLIC_SHARED_HOST_URL`), the only host identical for every tenant:
   * per-tenant gateway hosts are learned at login and can't go in a store
   * listing.
   */
  accountDeletion: '/account-deletion',

  auth: {
    root: '/auth',
    login: '/auth/login',
    signup: '/auth/signup',
    checkEmail: '/auth/check-email',
    verify: '/auth/verify',
    invite: '/auth/invite',
    passwordReset: '/auth/password-reset',
    error: '/auth/error',
  },

  customers: {
    list: (o?: { tab?: CustomerListTab }) => withQuery('/customers', { tab: o?.tab }),
    details: (id: string | number, o?: { tab?: CustomerDetailTab }) =>
      withQuery('/customers/details', { id, tab: o?.tab }),
    new: '/customers/new',
    edit: (id: string | number, o?: { tab?: CustomerEditTab }) => withQuery('/customers/edit', { id, tab: o?.tab }),
  },

  devices: {
    list: '/devices',
    archive: '/devices/archive',
    new: (o?: { organizationId?: string }) => withQuery('/devices/new', { organizationId: o?.organizationId }),
    details: (id: string | number, o?: { tab?: DeviceDetailTab; action?: 'runScript' }) =>
      withQuery('/devices/details', { id, tab: o?.tab, action: o?.action }),
    remoteShell: (id: string | number) => withQuery('/devices/details/remote-shell', { id }),
    remoteDesktop: (id: string | number) => withQuery('/devices/details/remote-desktop', { id }),
    fileManager: (id: string | number) => withQuery('/devices/details/file-manager', { id }),
  },

  scripts: {
    list: '/scripts',
    new: '/scripts/new',
    archived: '/scripts/archived',
    schedules: {
      list: '/scripts/schedules',
      archived: '/scripts/schedules/archived',
      new: '/scripts/schedules/new',
      // `search` seeds the target tab's search box — used by the Runs table to
      // drill into the Execution History tab narrowed to one run's executionId.
      details: (id: string | number, o?: { tab?: ScheduleDetailTab; search?: string }) =>
        withQuery('/scripts/schedules/details', { id, tab: o?.tab, search: o?.search }),
      /** One fire of a schedule. `id` is the `ScheduleRun` global id, not the schedule's. */
      run: (id: string | number) => withQuery('/scripts/schedules/run', { id }),
      edit: (id: string | number) => withQuery('/scripts/schedules/edit', { id }),
      devices: (id: string | number) => withQuery('/scripts/schedules/devices', { id }),
    },
    details: (id: string | number, o?: { tab?: ScriptDetailTab }) => withQuery('/scripts/details', { id, tab: o?.tab }),
    run: (id: string | number) => withQuery('/scripts/details/run', { id }),
    edit: (id: string | number) => withQuery('/scripts/edit', { id }),
    execution: (id: string | number) => withQuery('/scripts/executions', { id }),
  },

  monitoring: {
    root: (o?: { tab?: MonitoringTab }) => withQuery('/monitoring', { tab: o?.tab }),
    query: (id: string | number) => withQuery('/monitoring/query', { id }),
    queryNew: '/monitoring/query/new',
    queryEdit: (id: string | number) => withQuery('/monitoring/query/edit', { id }),
    policy: (id: string | number) => withQuery('/monitoring/policy', { id }),
    policyNew: '/monitoring/policy/new',
    policyEdit: (id: string | number) => withQuery('/monitoring/policy/edit', { id }),
  },

  tickets: {
    list: '/tickets',
    new: (o?: { edit?: string }) => withQuery('/tickets/new', { edit: o?.edit }),
    dialog: (id: string | number, o?: { tab?: 'chat' }) => withQuery('/tickets/dialog', { id, tab: o?.tab }),
    archive: '/tickets/archive',
    statuses: '/tickets/statuses',
  },

  logs: {
    page: '/logs-page',
    details: '/log-details',
  },

  knowledgeBase: {
    list: '/knowledge-base',
    new: '/knowledge-base/new',
    archive: '/knowledge-base/archive',
    details: (id: string | number) => withQuery('/knowledge-base/details', { id }),
    edit: (id: string | number) => withQuery('/knowledge-base/edit', { id }),
    folder: (id: string | number) => withQuery('/knowledge-base/folders', { id }),
  },

  settings: {
    root: (o?: { tab?: SettingsTab }) => withQuery('/settings', { tab: o?.tab }),
    employees: '/settings/employees',
    employeeDetails: (id: string | number) => withQuery('/settings/employees/details', { id }),
    aiSettings: (o?: { tab?: AiSettingsTab; edit?: boolean }) =>
      withQuery('/settings/ai-settings', { tab: o?.tab, edit: o?.edit }),
    apiKeys: '/settings/api-keys',
    sso: '/settings/sso',
    architecture: '/settings/architecture',
    billingUsage: '/settings/billing-usage',
    billingSubscription: '/settings/billing-usage/subscription',
  },

  /**
   * Canonical, page-independent URL for a Mingo dialog — the SHARE and DEEP-LINK
   * form. With `mingo-sidebar` on it resolves into the in-layout drawer (the page
   * redirects, carrying the id over as {@link MINGO_DIALOG_PARAM}); with the flag
   * off it is the legacy chat page. A sender — a push payload, an OS toast, a
   * copied link — cannot know which route the recipient is on, so this is the only
   * shape it can produce.
   */
  mingo: (o?: { dialogId?: string }) => withQuery('/mingo', { [MINGO_CANONICAL_DIALOG_PARAM]: o?.dialogId }),

  notifications: (o?: { tab?: NotificationsTab }) => withQuery('/notifications', { tab: o?.tab }),

  checkout: {
    success: '/checkout/success',
    cancel: '/checkout/cancel',
  },
} as const;

/**
 * Canonical, page-independent URL for SHARING or deep-linking a Mingo dialog —
 * what "Copy chat link" writes and what a notification tap navigates to.
 *
 * It is the drawer's own resting shape on a fixed landing page, NOT the `/mingo`
 * route: `/mingo` can only redirect here from the client, which costs a render and
 * a paint before the drawer appears. Emitting the destination directly means a
 * pasted link adopts on first commit with nothing rendered in between.
 *
 * `/mingo?dialogId=` stays supported for links already pasted elsewhere — see
 * `MingoPage` — but nothing produces it any more.
 */
export function mingoDialogLink(dialogId: string): string {
  return withMingoDialog(routes.dashboard, dialogId);
}
