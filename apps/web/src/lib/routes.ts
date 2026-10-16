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
import type { LegalDocumentType } from '@flamingo-stack/openframe-frontend-core/utils';
import type { DeviceStatus, InsightSeverity } from '@/generated/schema-enums';

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
    'assigned-articles',
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
    'incidents',
    'hardware',
    'os',
    'network',
    'users',
    'software',
    'remote-sessions',
    'device-logs',
    'assigned-articles',
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
  incidents: ['current', 'snoozed', 'archived'],
} as const;

export type CustomerListTab = (typeof TAB_IDS.customersList)[number];
export type CustomerDetailTab = (typeof TAB_IDS.customerDetails)[number];
export type CustomerEditTab = (typeof TAB_IDS.customerEdit)[number];
export type DeviceDetailTab = (typeof TAB_IDS.deviceDetails)[number];
export type IncidentsTab = (typeof TAB_IDS.incidents)[number];
export type ScriptDetailTab = (typeof TAB_IDS.scriptDetails)[number];
export type SoftwareDetailTab = (typeof TAB_IDS.softwareDetails)[number];
export type ScheduleDetailTab = (typeof TAB_IDS.scheduleDetails)[number];
export type MonitoringTab = (typeof TAB_IDS.monitoring)[number];
export type QueryDetailTab = (typeof TAB_IDS.queryDetails)[number];
export type SettingsTab = (typeof TAB_IDS.settings)[number];
export type AiSettingsTab = (typeof TAB_IDS.aiSettings)[number];

/**
 * What `/settings/billing-usage` can be asked to open on arrival. The app-wide
 * AI balance bar deep-links to the Manage AI Balance modal with it; the page
 * reads the param as the modal's open state and clears it on close.
 */
export const MANAGE_AI_BALANCE_ACTION = 'manageAiBalance';
export type BillingUsageAction = typeof MANAGE_AI_BALANCE_ACTION;
export type NotificationsTab = (typeof TAB_IDS.notifications)[number];

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

type QueryValue = string | number | boolean | readonly string[] | undefined | null;

/**
 * Append a typed query object to a base path. Skips `undefined`/`null` values
 * and URL-encodes the rest, so every parametrized route shares identical query
 * semantics. An array becomes one repeated key per value (`?statuses=A&statuses=B`),
 * the form `useApiParams` writes and reads for its `array` params; an empty array
 * is skipped like `undefined`.
 */
function withQuery(base: string, query?: Record<string, QueryValue>): string {
  if (!query) return base;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) qs.append(key, item);
    } else {
      qs.set(key, String(value));
    }
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

/*
 * List paths that are both a plain string (`list`, ~30 call sites incl. the
 * navigation config) and the base of a `filtered(...)` builder — named once here so
 * the path still lives in exactly one place.
 */
const DEVICES_LIST_PATH = '/devices';
const TICKETS_LIST_PATH = '/tickets';
const INCIDENTS_LIST_PATH = '/incidents';

export const routes = {
  root: '/',
  dashboard: '/dashboard',
  onboarding: '/onboarding',

  /**
   * The Mingo-first shell (flag `mingo-first`, read through `useShellVariant()`).
   * Each page resolves itself per variant: in the classic shell it redirects to its
   * classic equivalent (`home` and `archive` → `/dashboard`, `chat` →
   * `/dashboard?mingoDialog=`, where the drawer opens it), so a link to any of them
   * is safe whichever shell the recipient runs.
   */
  mingo: {
    /** Mingo's home — the Mingo-first shell's landing page (`/dashboard` redirects here). */
    home: '/mingo',
    /**
     * One conversation as a page. The dialog id rides `?id=` like every detail page
     * (static export: no dynamic segment, see ROUTES.md). The canonical link to a chat
     * is {@link mingoDialogLink}, which builds this.
     */
    chat: (id: string | number) => withQuery('/mingo/chat', { id }),
    /** Archived chats. */
    archive: '/mingo/archive',
  },

  /** What needs a person's approval. Mingo-first only; the classic shell redirects it to `/notifications`. */
  approvals: '/approvals',
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
    // One page per legal document. `[docType]` is enumerable (the route's
    // `generateStaticParams` prerenders the lib's `LEGAL_DOCUMENT_TYPES`); the
    // Help Center links the ones the hub's list says are published.
    legal: (docType: LegalDocumentType) => `/help-center/legal/${docType}`,
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
    verify: '/auth/verify',
    invite: '/auth/invite',
    passwordReset: '/auth/password-reset',
    /**
     * Where every auth failure ends. `ref` is the auth server's reference for what went wrong: an
     * `AuthErrorCode` name (`SSO_SESSION_EXPIRED`) or the 8-character key of a message it stored for a
     * few minutes. The page resolves it through the `authErrorMessage` query and shows only what comes
     * back; nothing in this URL is rendered. The old `error=<text>` parameter is gone on purpose: it let
     * anyone put their own sentence on the page under our logo.
     */
    error: (o?: { ref?: string }) => withQuery('/auth/error', { ref: o?.ref }),
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
    list: DEVICES_LIST_PATH,
    /**
     * The Devices list narrowed to some customers and statuses (`?organizationIds=`,
     * `?statuses=`, what `useDevicesUrlParams` reads). `organizationIds` are the RAW
     * `Organization.organizationId` values. An empty list means the page default (every
     * customer; online + offline), so it is dropped like an absent option.
     */
    filtered: (o: { organizationIds?: readonly string[]; statuses?: readonly DeviceStatus[] }) =>
      withQuery(DEVICES_LIST_PATH, { organizationIds: o.organizationIds, statuses: o.statuses }),
    archive: '/devices/archive',
    /** The tenant's remote sessions on every device - a page tab beside the Devices list. */
    remoteSessions: '/devices/remote-sessions',
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
    list: TICKETS_LIST_PATH,
    /**
     * The Tickets list with the view it reads from its URL (`TicketsView`): `status`
     * holds ticket STATUS IDS (the tenant's own statuses, not an enum) and narrows the
     * TABLE only — the board ignores it, so a status filter needs `viewMode: 'table'`
     * to show. No `viewMode` = the page default (the board).
     */
    filtered: (o: { status?: readonly string[]; viewMode?: 'table' | 'board' }) =>
      withQuery(TICKETS_LIST_PATH, { status: o.status, viewMode: o.viewMode }),
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
    list: INCIDENTS_LIST_PATH,
    /**
     * The Incidents list narrowed by severity (`?severity=`, `INCIDENT_FILTER_PARAMS`)
     * on a tab (`?tab=`, default `current`).
     */
    filtered: (o: { severity?: readonly InsightSeverity[]; tab?: IncidentsTab }) =>
      withQuery(INCIDENTS_LIST_PATH, { tab: o.tab, severity: o.severity }),
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
    billingUsage: (o?: { action?: BillingUsageAction }) => withQuery('/settings/billing-usage', { action: o?.action }),
    /** Tenant-wide device logs (the per-device ones are the device's `device-logs` tab). */
    troubleshooting: '/settings/troubleshooting',
  },

  /**
   * Cloud Tenant Management: Microsoft 365 / Google Workspace directory
   * connections. A module of its own — the sidebar's "Integrations" item — not a
   * Settings section (it sat under `/settings/tenant-management` until 2026-09;
   * `not-found.tsx` remaps the old paths). Sub-pages take the connection id as
   * `?id=` like every other detail page (static-export constraint, see ROUTES.md).
   */
  cloudTenantManagement: {
    list: '/cloud-tenant-management',
    // `id`: the connection a New flow already created, so a reload or Back resumes it instead of a blank form.
    new: (o?: { id?: string | number }) => withQuery('/cloud-tenant-management/new', { id: o?.id }),
    details: (id: string | number) => withQuery('/cloud-tenant-management/details', { id }),
    edit: (id: string | number) => withQuery('/cloud-tenant-management/edit', { id }),
    reconnect: (id: string | number) => withQuery('/cloud-tenant-management/reconnect', { id }),
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
 * It is the chat ROUTE, whichever shell the recipient runs: a sender — a push
 * payload, an OS toast, a copied link — cannot know that, so the link must resolve
 * in both. In the Mingo-first shell the page IS the chat; in the classic shell it
 * redirects to `withMingoDialog(routes.dashboard, id)`, the drawer's resting URL,
 * which the drawer's URL sync adopts. Links written by older bundles
 * (`/dashboard?mingoDialog=`) keep working the other way round: the classic shell
 * adopts them as before, and the Mingo-first shell's `MingoDialogParamBridge`
 * forwards `?mingoDialog=` on any route to this page.
 */
export function mingoDialogLink(dialogId: string): string {
  return routes.mingo.chat(dialogId);
}
