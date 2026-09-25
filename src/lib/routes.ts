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
    'customer-device-guardrails',
  ],
  customerEdit: ['details', 'ai-configuration', 'guardrails', 'device-guardrails'],
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
    'remote-sessions',
  ],
  scriptDetails: ['details', 'executions'],
  softwareDetails: ['devices', 'vulnerabilities'],
  scheduleDetails: ['scripts', 'devices', 'runs', 'executions'],
  monitoring: ['policies', 'queries'],
  /** Query detail page (`/monitoring/query?id=`) — the panel under its tab bar. */
  queryDetails: ['results', 'devices'],
  settings: ['ai-settings', 'architecture', 'company-and-users', 'api-keys', 'sso-configuration', 'profile'],
  aiSettings: ['mingo', 'customer', 'guardrails', 'device-guardrails'],
  notifications: ['history'],
} as const;

export type CustomerListTab = (typeof TAB_IDS.customersList)[number];
export type CustomerDetailTab = (typeof TAB_IDS.customerDetails)[number];
export type CustomerEditTab = (typeof TAB_IDS.customerEdit)[number];
export type DeviceDetailTab = (typeof TAB_IDS.deviceDetails)[number];
export type ScriptDetailTab = (typeof TAB_IDS.scriptDetails)[number];
export type SoftwareDetailTab = (typeof TAB_IDS.softwareDetails)[number];
export type ScheduleDetailTab = (typeof TAB_IDS.scheduleDetails)[number];
export type MonitoringTab = (typeof TAB_IDS.monitoring)[number];
export type QueryDetailTab = (typeof TAB_IDS.queryDetails)[number];
export type SettingsTab = (typeof TAB_IDS.settings)[number];
export type AiSettingsTab = (typeof TAB_IDS.aiSettings)[number];
export type NotificationsTab = (typeof TAB_IDS.notifications)[number];

/** Legal documents the Help Center `[docType]` route prerenders. */
export type HelpCenterLegalDoc = 'privacy' | 'terms';

// --------------------------------------------------------------------------
// Ticket prefill keys (shared with the ticket form and its page)
// --------------------------------------------------------------------------

/**
 * What another page can hand the NEW-ticket form to start from, as `/tickets/new`
 * query params ("Create Ticket" on an incident). One list: the builder's options,
 * the form's `TicketPrefill` and the page's reader all derive from it, so a key
 * cannot be added to one and silently dropped by another. Ids are the raw ones
 * the form's pickers use (`Organization.organizationId`, `Machine.machineId`,
 * `User.id`); the names label those picks before the option lists have loaded.
 * `insightId` is the STORED insight id (`CreateTicketInput.insightId`), which
 * links the ticket to the incident it is filed from; `insightTitle` labels it.
 */
export const TICKET_PREFILL_KEYS = [
  'title',
  'description',
  'organizationId',
  'organizationName',
  'deviceId',
  'deviceName',
  'assigneeId',
  'assigneeName',
  'insightId',
  'insightTitle',
] as const;

export type TicketPrefill = Partial<Record<(typeof TICKET_PREFILL_KEYS)[number], string>>;

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
    trustCenter: '/help-center/trust-center',
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

  /**
   * Landing page behind the mobile-app install QR code, and the fallback for
   * everything the shared gateway's `User-Agent` predicates do not redirect to a
   * store — desktop, crawlers, and iPadOS asking for the desktop site.
   *
   * Public and session-less for the same reason {@link routes.accountDeletion} is:
   * it is scanned from a phone that has never signed in. The path is short and
   * deliberately not `/get`, which would read as the desktop installer's
   * `get.openframe.io`. Encoded in a QR that cannot be reprinted, so treat it as
   * immovable — see `lib/mobile-app-links.ts`.
   */
  mobileApp: '/mobile',

  auth: {
    root: '/auth',
    login: '/auth/login',
    checkEmail: '/auth/check-email',
    verify: '/auth/verify',
    invite: '/auth/invite',
    passwordReset: '/auth/password-reset',
    error: '/auth/error',
    /**
     * Where the auth server sends an SSO login whose identity has no account yet
     * (`openframe.sso.login.signup-continue-url`). The page reads the asserted identity from the
     * SAS session and collects only what SSO cannot supply: organization name and domain.
     */
    ssoContinue: '/auth/sso-continue',
    /**
     * Terminal notice for an SSO identity with no account in a login-only mobile build, where the web
     * would continue into `ssoContinue`. Nothing about the identity travels here.
     */
    noAccount: '/auth/no-account',
    /**
     * "One Last Step": where the auth server parks an SSO flow that is about to CREATE a user - a new
     * member accepting an invitation, or a first login through a shared domain
     * (`openframe.sso.join-confirm-url`). The page confirms the identity + organization from the SAS
     * session and takes the Terms consent; nothing travels in the URL.
     */
    ssoJoin: '/auth/sso-join',
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
    remoteSessionRecording: (id: string | number) => withQuery('/devices/details/remote-session', { id }),
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

  /**
   * Fleet software inventory. The three views are separate routes, not `?tab=`
   * views of one page (like `/scripts` vs `/scripts/schedules`), so they have no
   * `TAB_IDS` entry — `SoftwareTabNavigation` navigates between them.
   */
  software: {
    list: '/software',
    /** Software Actions — install/update runs, dispatched and scheduled. */
    actions: '/software/actions',
    vulnerabilities: '/software/vulnerabilities',
    install: '/software/install',
    update: '/software/update',
    /**
     * Software Update Details — one install or update run, by its Software
     * Action id (the opaque one the Software Actions table links by; the run's
     * executionId is accepted too).
     */
    action: (id: string | number) => withQuery('/software/actions/action', { id }),
    /** A CVE id (`CVE-2024-38063`) rides as `id`, like every other detail page. */
    vulnerability: (cveId: string) => withQuery('/software/vulnerability', { id: cveId }),
    details: (id: string | number, o?: { tab?: SoftwareDetailTab }) =>
      withQuery('/software/details', { id, tab: o?.tab }),
  },

  monitoring: {
    root: (o?: { tab?: MonitoringTab }) => withQuery('/monitoring', { tab: o?.tab }),
    query: (id: string | number, o?: { tab?: QueryDetailTab }) => withQuery('/monitoring/query', { id, tab: o?.tab }),
    queryNew: '/monitoring/query/new',
    queryEdit: (id: string | number) => withQuery('/monitoring/query/edit', { id }),
    policy: (id: string | number) => withQuery('/monitoring/policy', { id }),
    policyNew: '/monitoring/policy/new',
    policyEdit: (id: string | number) => withQuery('/monitoring/policy/edit', { id }),
  },

  tickets: {
    list: '/tickets',
    /** `edit` opens an existing ticket; a `TicketPrefill` starts a NEW one — one or the other, never both. */
    new: (o?: { edit: string } | TicketPrefill) => withQuery('/tickets/new', o),
    dialog: (id: string | number, o?: { tab?: 'chat' }) => withQuery('/tickets/dialog', { id, tab: o?.tab }),
    archive: '/tickets/archive',
    statuses: '/tickets/statuses',
  },

  logs: {
    page: '/logs-page',
    /** The page needs all five params — a missing one redirects to `logs.page`. */
    details: (
      id: string | number,
      o: { ingestDay: string; toolType: string; eventType: string; timestamp?: string | null },
    ) => withQuery('/log-details', { id, ...o }),
  },

  // UI says "incident"; the API says "insight". `id` is `Insight.id`, the opaque
  // handle the `insight(id:)` query takes.
  incidents: {
    list: '/incidents',
    details: (id: string | number) => withQuery('/incidents/details', { id }),
  },

  knowledgeBase: {
    list: '/knowledge-base',
    new: (o?: { folderId?: string | number }) => withQuery('/knowledge-base/new', { folderId: o?.folderId }),
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
    downloadApps: '/settings/download-apps',
    billingUsage: '/settings/billing-usage',
    // Tenant Management (CU-86akj8ajt): Microsoft 365 / Google Workspace directory
    // connections. Sub-pages take the connection id as `?id=` like every other
    // detail page (static-export constraint, see ROUTES.md).
    tenantManagement: '/settings/tenant-management',
    tenantNew: '/settings/tenant-management/new',
    tenantDetails: (id: string | number) => withQuery('/settings/tenant-management/details', { id }),
    tenantEdit: (id: string | number) => withQuery('/settings/tenant-management/edit', { id }),
    tenantReconnect: (id: string | number) => withQuery('/settings/tenant-management/reconnect', { id }),
  },

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
 * The chat has no route of its own: it is a drawer floating over whatever page is
 * showing, so the shareable shape is the drawer's resting state on a fixed landing
 * page. A sender — a push payload, an OS toast, a copied link — cannot know which
 * route the recipient is on, so this is the only shape it can produce, and a pasted
 * link adopts on first commit with nothing rendered in between.
 */
export function mingoDialogLink(dialogId: string): string {
  return withMingoDialog(routes.dashboard, dialogId);
}
