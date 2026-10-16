import {
  ActivityIcon,
  AlertTriangleIcon,
  BookBookmarkIcon,
  BracketCurlyEllipsisVrIcon,
  BracketCurlyIcon,
  BracketSquareCheckIcon,
  ChartDonutIcon,
  ClipboardListIcon,
  ClockHistoryIcon,
  CodingForkIcon,
  CompassIcon,
  FolderShieldIcon,
  HeadsetIcon,
  IdCardIcon,
  LaptopMobileIcon,
  MonitorIcon,
  Parcel02Icon,
  QuestionCircleIcon,
  RadarIcon,
  Settings02Icon,
  TagIcon,
  TimerIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type {
  NavigationSidebarItem,
  NavigationSidebarMatch,
} from '@flamingo-stack/openframe-frontend-core/types/navigation';
import type { ComponentType } from 'react';
import type { UnreadCountsByCategory } from '@/app/components/notifications/unread-counts-hydrator';
import { NotificationCategory } from '@/generated/schema-enums';
import { isAuthOnlyMode, isSaasTenantMode } from './app-mode';
import { routes } from './routes';

/**
 * The stamp on a module that is shipped but still behind its flag. The core sidebar
 * draws it after the label as the warning `Tag` (the chip Settings stamps "Beta"
 * with), as the bare word under the glyph in the minimized rail, and after the
 * label on the mobile burger card; the row's accessible name becomes
 * "Software (Beta)". Cased as read — the surfaces upper-case it.
 */
const BETA_BADGE = 'Beta';

/** Onboarding chrome state used to conditionally show the "Onboarding" tab + badge. */
export interface OnboardingNavState {
  /** User "Get Started" is in progress (not completed / skipped). */
  inProgress: boolean;
  /** Outstanding step count, shown as the badge. */
  remaining: number;
}

/**
 * The flags the sidebar's shape depends on.
 *
 * Passed in rather than read here on purpose: this runs inside the shell's
 * `useMemo`, and the caller reads them through `useFeatureFlag` so the memo
 * recomputes if a value changes.
 *
 * Plain booleans, and the reason that is safe lives one level up: while the flags are
 * unanswered the shell passes `loading` to the core sidebar, which draws placeholder
 * rows and ignores `items` entirely. So these values are only ever LOOKED AT once
 * they are real.
 *
 * That matters because `false` here is indistinguishable from "not answered yet".
 * Every entry is gated in the "on shows it" direction, so a guessed `false` renders
 * fewer rows rather than rows the tenant has no right to — but only the `loading`
 * wiring in `app-layout.tsx` keeps that window from ever being looked at. If it is
 * removed, or an "on HIDES it" flag is ever added here, this type has to go back to
 * three states.
 */
export interface NavigationFlags {
  insights: boolean;
  softwareManagement: boolean;
  tenantManagement: boolean;
}

// --------------------------------------------------------------------------
// The module table — every page the sidebar can lead to, described once
// --------------------------------------------------------------------------

/** What an entry needs to exist. Every gate shows the entry when it holds, never hides one. */
type NavGate = 'saas-tenant' | keyof NavigationFlags;

interface NavModule {
  label: string;
  /** The label in the grouped (Mingo-first) sidebar, where the Figma names differ. */
  groupedLabel?: string;
  icon: ComponentType<{ size?: number }>;
  /** Where the entry leads. */
  path: string;
  /**
   * The pathname prefixes of the module's pages. The flat sidebar marks the entry
   * active on `pathname.startsWith(prefix)`, exactly as it always has; the grouped
   * one hands them to the core sidebar as segment-prefix rules (its `match`).
   */
  prefixes: readonly string[];
  /** Grouped only: the active rule when a prefix cannot say it (a `?tab=` view). */
  match?: NavigationSidebarMatch;
  gates?: readonly NavGate[];
  /** The unread-notification category counted on the entry. */
  category?: NotificationCategory;
  /** Shipped, still behind its flag: the "Beta" stamp. */
  beta?: boolean;
}

/**
 * The ONE table both sidebars are built from: label, icon, route, active rule,
 * gates, badge category and Beta stamp per module. The classic sidebar
 * ({@link getNavigationItems}) lists some of them flat; the Mingo-first one
 * ({@link getGroupedNavigationItems}) arranges them in the Figma groups. A gate or a
 * badge changed here changes both.
 */
const NAV_MODULES = {
  onboarding: { label: 'Onboarding', icon: CompassIcon, path: routes.onboarding, prefixes: ['/onboarding'] },
  dashboard: {
    label: 'Dashboard',
    icon: ChartDonutIcon,
    path: routes.dashboard,
    prefixes: ['/dashboard'],
    category: NotificationCategory.DASHBOARD,
  },
  // saas-tenant only — the insights API lives in saas-api.
  incidents: {
    label: 'Incidents',
    icon: AlertTriangleIcon,
    path: routes.incidents.list,
    prefixes: ['/incidents'],
    gates: ['saas-tenant', 'insights'],
    category: NotificationCategory.INSIGHTS,
    beta: true,
  },
  // The route was renamed from `/organizations`; the id (and the badge key) was not.
  organizations: {
    label: 'Customers',
    icon: IdCardIcon,
    path: routes.customers.list(),
    prefixes: ['/customers'],
    category: NotificationCategory.CUSTOMERS,
  },
  devices: {
    label: 'Devices',
    icon: MonitorIcon,
    path: routes.devices.list,
    prefixes: ['/devices'],
    category: NotificationCategory.DEVICES,
  },
  scripts: {
    label: 'Scripts',
    icon: BracketCurlyIcon,
    path: routes.scripts.list,
    prefixes: ['/scripts'],
    category: NotificationCategory.SCRIPTS,
  },
  schedules: {
    label: 'Schedules',
    icon: TimerIcon,
    path: routes.scripts.schedules.list,
    prefixes: ['/scripts/schedules'],
  },
  monitoring: {
    label: 'Monitoring',
    icon: RadarIcon,
    path: routes.monitoring.root(),
    prefixes: ['/monitoring'],
    category: NotificationCategory.MONITORING,
  },
  // The two `/monitoring` tabs. No `tab` is the policies tab (the page's default).
  policies: {
    label: 'Policies',
    icon: FolderShieldIcon,
    path: routes.monitoring.root({ tab: 'policies' }),
    prefixes: ['/monitoring/policy'],
    match: [{ path: '/monitoring', exact: true, query: { tab: ['policies', null] } }, '/monitoring/policy'],
    category: NotificationCategory.MONITORING,
  },
  queries: {
    label: 'Queries',
    icon: BracketCurlyEllipsisVrIcon,
    path: routes.monitoring.root({ tab: 'queries' }),
    prefixes: ['/monitoring/query'],
    match: [{ path: '/monitoring', exact: true, query: { tab: 'queries' } }, '/monitoring/query'],
  },
  // The Software module — behind `software-management`, like its routes.
  software: {
    label: 'Software',
    icon: Parcel02Icon,
    path: routes.software.list,
    prefixes: ['/software'],
    gates: ['softwareManagement'],
    category: NotificationCategory.SOFTWARE,
    beta: true,
  },
  // A view of the Software module, so the same gate. The detail page is singular.
  vulnerabilities: {
    label: 'Vulnerabilities',
    icon: BracketSquareCheckIcon,
    path: routes.software.vulnerabilities,
    prefixes: ['/software/vulnerabilities', '/software/vulnerability'],
    gates: ['softwareManagement'],
  },
  logs: {
    label: 'Logs',
    icon: ClipboardListIcon,
    path: routes.logs.page,
    prefixes: ['/logs-page', '/log-details'],
    category: NotificationCategory.LOGS,
  },
  tickets: {
    label: 'Tickets',
    icon: TagIcon,
    path: routes.tickets.list,
    prefixes: ['/tickets'],
    gates: ['saas-tenant'],
    category: NotificationCategory.TICKETS,
  },
  worktime: { label: 'Worktime', icon: ClockHistoryIcon, path: routes.worktime, prefixes: ['/worktime'] },
  // Cloud Tenant Management — behind `tenant-management`, like its routes.
  integrations: {
    label: 'Integrations',
    groupedLabel: 'Cloud tenants',
    icon: CodingForkIcon,
    path: routes.cloudTenantManagement.list,
    prefixes: ['/cloud-tenant-management'],
    gates: ['tenantManagement'],
    beta: true,
  },
  'knowledge-base': {
    label: 'Knowledge Base',
    icon: BookBookmarkIcon,
    path: routes.knowledgeBase.list,
    prefixes: ['/knowledge-base'],
  },
  'help-center': {
    label: 'Help Center',
    icon: QuestionCircleIcon,
    path: routes.helpCenter.root,
    prefixes: ['/help-center'],
  },
  settings: { label: 'Settings', icon: Settings02Icon, path: routes.settings.root(), prefixes: ['/settings'] },
} as const satisfies Record<string, NavModule>;

type NavModuleId = keyof typeof NAV_MODULES;

/**
 * Categories the classic sidebar never counted. SOFTWARE was never wired to a row
 * there; the grouped sidebar counts it on Software. Kept out of the flat rows so the
 * classic shell does not change under the Mingo-first one.
 */
const GROUPED_ONLY_CATEGORIES: ReadonlySet<NotificationCategory> = new Set([NotificationCategory.SOFTWARE]);

/** The classic sidebar: the modules in its order, then the bottom block. */
const FLAT_LAYOUT = {
  primary: [
    'dashboard',
    // Right under Dashboard (Figma): the current incidents are the first thing a
    // technician looks at.
    'incidents',
    'organizations',
    'devices',
    'scripts',
    'monitoring',
    'software',
    'logs',
    'tickets',
    'worktime',
    // Integrations (Figma: the last primary item).
    'integrations',
  ],
  secondary: ['knowledge-base', 'help-center', 'settings'],
} as const satisfies Record<'primary' | 'secondary', readonly NavModuleId[]>;

interface NavGroup {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  children: readonly NavModuleId[];
}

/**
 * The Mingo-first sidebar (Figma `navigation-sidebar`, node 3741:24946): four groups,
 * then Knowledge Base as the last primary row. No Dashboard — the Mingo home replaces
 * it — and no bottom block: Help Center and Settings live in the account menu
 * (`MingoAccountPopover`), so the chat history below the tree gets the height (PLAN
 * §3.6, revised after the browser pass).
 */
const GROUPED_LAYOUT: { groups: readonly NavGroup[]; leaves: readonly NavModuleId[] } = {
  groups: [
    {
      id: 'inventory',
      label: 'Inventory',
      icon: LaptopMobileIcon,
      children: ['organizations', 'devices', 'software', 'integrations'],
    },
    { id: 'service-desk', label: 'Service Desk', icon: HeadsetIcon, children: ['tickets', 'worktime'] },
    {
      id: 'automation',
      label: 'Automation',
      icon: BracketCurlyIcon,
      children: ['scripts', 'schedules', 'policies', 'queries'],
    },
    { id: 'monitor', label: 'Monitor', icon: ActivityIcon, children: ['incidents', 'vulnerabilities', 'logs'] },
  ],
  leaves: ['knowledge-base'],
};

/** Placeholder rows per section while the chrome loads, so the handoff moves nothing. */
export const NAVIGATION_LOADING_ROWS = {
  // 7 primary (Dashboard, Customers, Devices, Scripts, Monitoring, Logs, Tickets)
  // and 2 secondary (Knowledge Base, Settings).
  flat: { primary: 7, secondary: 2 },
  // The four groups and Knowledge Base; no bottom block.
  grouped: { primary: GROUPED_LAYOUT.groups.length + GROUPED_LAYOUT.leaves.length, secondary: 0 },
} as const;

function moduleShown(entry: NavModule, flags: NavigationFlags): boolean {
  return (entry.gates ?? []).every(gate => (gate === 'saas-tenant' ? isSaasTenantMode() : flags[gate]));
}

function unreadOf(
  entry: NavModule,
  unreadCounts: UnreadCountsByCategory | undefined,
  variant: 'flat' | 'grouped',
): number | undefined {
  const { category } = entry;
  if (!category || (variant === 'flat' && GROUPED_ONLY_CATEGORIES.has(category))) return undefined;
  return unreadCounts?.[category];
}

// --------------------------------------------------------------------------
// Flat — the classic shell
// --------------------------------------------------------------------------

function flatItem(
  id: NavModuleId,
  pathname: string,
  unreadCounts: UnreadCountsByCategory | undefined,
  section?: 'secondary',
): NavigationSidebarItem {
  const entry: NavModule = NAV_MODULES[id];
  const Icon = entry.icon;
  const item: NavigationSidebarItem = {
    id,
    label: entry.label,
    icon: <Icon size={24} />,
    path: entry.path,
    isActive: entry.prefixes.some(prefix => pathname.startsWith(prefix)),
    ...(entry.beta ? { badge: BETA_BADGE } : {}),
    ...(section ? { section } : {}),
  };
  const unreadCount = unreadOf(entry, unreadCounts, 'flat');
  return unreadCount ? { ...item, unreadCount } : item;
}

/** The classic shell's sidebar: one flat list, active state from `pathname`. */
export const getNavigationItems = (
  pathname: string,
  flags: NavigationFlags,
  unreadCounts?: UnreadCountsByCategory,
  onboarding?: OnboardingNavState,
): NavigationSidebarItem[] => {
  if (isAuthOnlyMode()) {
    return [];
  }

  const shown = (id: NavModuleId) => moduleShown(NAV_MODULES[id], flags);
  return [
    // Shown only while the user's Get Started onboarding is in progress. Sits at
    // the very top with a count badge of steps still outstanding.
    ...(onboarding?.inProgress
      ? [
          {
            id: 'onboarding',
            label: NAV_MODULES.onboarding.label,
            icon: <CompassIcon size={24} />,
            path: NAV_MODULES.onboarding.path,
            isActive: pathname.startsWith('/onboarding'),
            // Solid accent pill with the remaining-step count (matches Figma) — the
            // `unreadCount` slot, not `badge` (which is plain accent-colored text).
            unreadCount: onboarding.remaining,
          } satisfies NavigationSidebarItem,
        ]
      : []),
    ...FLAT_LAYOUT.primary.filter(shown).map(id => flatItem(id, pathname, unreadCounts)),
    ...FLAT_LAYOUT.secondary.filter(shown).map(id => flatItem(id, pathname, unreadCounts, 'secondary')),
  ];
};

// --------------------------------------------------------------------------
// Grouped — the Mingo-first shell
// --------------------------------------------------------------------------

function groupedLeaf(
  id: NavModuleId,
  unreadCounts: UnreadCountsByCategory | undefined,
  { iconSize }: { iconSize: 16 | 20 },
): NavigationSidebarItem {
  const entry: NavModule = NAV_MODULES[id];
  const Icon = entry.icon;
  const unreadCount = unreadOf(entry, unreadCounts, 'grouped');
  return {
    id,
    label: entry.groupedLabel ?? entry.label,
    icon: <Icon size={iconSize} />,
    path: entry.path,
    // No `isActive`: the core sidebar resolves the active entry from
    // `currentPath` through these rules, the most specific one winning
    // (`/scripts` vs `/scripts/schedules`, the two `/monitoring` tabs).
    match: entry.match ?? entry.prefixes,
    ...(entry.beta ? { badge: BETA_BADGE } : {}),
    ...(unreadCount ? { unreadCount } : {}),
  };
}

/**
 * The Mingo-first shell's sidebar (`NavigationSidebarConfig.variant: 'grouped'`): the
 * Figma groups with the classic sidebar's gates and badges. The active entry is the
 * core sidebar's to resolve from `currentPath` (each entry carries its `match`), so
 * nothing here reads the location.
 *
 * A parent carries the sum of its children's unread counts: a group is closed unless
 * it holds the current page, and its children's badges are not drawn while it is.
 */
export const getGroupedNavigationItems = (
  flags: NavigationFlags,
  unreadCounts?: UnreadCountsByCategory,
  onboarding?: OnboardingNavState,
): NavigationSidebarItem[] => {
  if (isAuthOnlyMode()) {
    return [];
  }

  const shown = (id: NavModuleId) => moduleShown(NAV_MODULES[id], flags);
  const groups = GROUPED_LAYOUT.groups.flatMap((group): NavigationSidebarItem[] => {
    const children = group.children.filter(shown).map(id => groupedLeaf(id, unreadCounts, { iconSize: 16 }));
    if (children.length === 0) return [];
    const Icon = group.icon;
    const unreadCount = children.reduce((sum, child) => sum + (child.unreadCount ?? 0), 0);
    return [
      {
        id: group.id,
        label: group.label,
        icon: <Icon size={20} />,
        children,
        ...(unreadCount ? { unreadCount } : {}),
      },
    ];
  });

  return [
    // Above the groups while Get Started is in progress, as in the classic sidebar.
    ...(onboarding?.inProgress
      ? [{ ...groupedLeaf('onboarding', undefined, { iconSize: 20 }), unreadCount: onboarding.remaining }]
      : []),
    ...groups,
    ...GROUPED_LAYOUT.leaves.filter(shown).map(id => groupedLeaf(id, unreadCounts, { iconSize: 20 })),
  ];
};
