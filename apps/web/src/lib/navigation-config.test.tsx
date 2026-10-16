import { resolveNavigationActive } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import type { NavigationSidebarItem } from '@flamingo-stack/openframe-frontend-core/types/navigation';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { UnreadCountsByCategory } from '@/app/components/notifications/unread-counts-hydrator';
import { NotificationCategory } from '@/generated/schema-enums';
import {
  getGroupedNavigationItems,
  getNavigationItems,
  NAVIGATION_LOADING_ROWS,
  type NavigationFlags,
  type OnboardingNavState,
} from './navigation-config';

type AppMode = 'oss-tenant' | 'saas-tenant' | 'saas-shared';

/** `window.__ENV` is what next-runtime-env's `env()` reads in the browser — and `app-mode.ts` with it. */
function setAppMode(mode: AppMode | undefined) {
  window.__ENV = (mode === undefined ? {} : { NEXT_PUBLIC_APP_MODE: mode }) as typeof window.__ENV;
}

afterEach(() => setAppMode(undefined));

/** Every category the schema knows, each with its own count, so a badge names the category it came from. */
const ALL_UNREAD: UnreadCountsByCategory = Object.fromEntries(
  Object.values(NotificationCategory).map((category, index) => [category, index + 1]),
);

const FLAG_COMBOS: NavigationFlags[] = [false, true].flatMap(insights =>
  [false, true].flatMap(softwareManagement =>
    [false, true].map(tenantManagement => ({ insights, softwareManagement, tenantManagement })),
  ),
);

const ONBOARDING_CASES: Array<OnboardingNavState | undefined> = [undefined, { inProgress: true, remaining: 3 }];

/**
 * One line per entry, every field the core sidebar reads, plus the entry's own key set: a field
 * that starts riding along (a `match`, `children`) changes the line even when the sidebar would
 * draw the same thing.
 */
function describeItem(item: NavigationSidebarItem): string {
  const icon = item.icon as ReactElement<{ size?: number }>;
  const iconName = (icon.type as { name?: string }).name;
  return [
    item.id,
    item.label,
    item.path ?? '-',
    item.section ?? 'primary',
    item.badge ?? '-',
    `unread=${item.unreadCount ?? 0}`,
    item.isActive ? 'ACTIVE' : '-',
    `${iconName}@${icon.props.size}`,
    `keys=${Object.keys(item).sort().join(',')}`,
  ].join(' | ');
}

function flagsLabel(flags: NavigationFlags): string {
  return Object.entries(flags)
    .map(([name, on]) => `${name}:${on ? 'on' : 'off'}`)
    .join(' ');
}

/**
 * The classic shell's sidebar (`getNavigationItems`) must not move while the Mingo-first shell
 * grows a grouped one out of the same module table. The snapshot was recorded from the
 * implementation BEFORE that table existed; a diff in it is a change to the classic shell.
 */
describe('flat navigation (classic shell)', () => {
  it('is unchanged for every app mode × flag × onboarding combination', () => {
    const output: Record<string, string[]> = {};
    for (const mode of ['oss-tenant', 'saas-tenant'] as const) {
      setAppMode(mode);
      for (const flags of FLAG_COMBOS) {
        for (const onboarding of ONBOARDING_CASES) {
          const key = `${mode} | ${flagsLabel(flags)} | onboarding:${onboarding ? 'in-progress' : 'none'}`;
          output[key] = getNavigationItems('/devices', flags, ALL_UNREAD, onboarding).map(describeItem);
        }
      }
    }
    expect(output).toMatchSnapshot();
  });

  it('marks the same entry active for every route', () => {
    setAppMode('saas-tenant');
    const allOn: NavigationFlags = { insights: true, softwareManagement: true, tenantManagement: true };
    const pathnames = [
      '/',
      '/dashboard',
      '/onboarding',
      '/incidents',
      '/incidents/details',
      '/customers',
      '/customers/details',
      '/devices',
      '/devices/details',
      '/devicesx',
      '/scripts',
      '/scripts/schedules',
      '/scripts/schedules/details',
      '/monitoring',
      '/monitoring/policy',
      '/monitoring/query',
      '/software',
      '/software/vulnerabilities',
      '/software/vulnerability',
      '/logs-page',
      '/log-details',
      '/tickets',
      '/tickets/dialog',
      '/worktime',
      '/cloud-tenant-management',
      '/cloud-tenant-management/details',
      '/knowledge-base',
      '/help-center',
      '/help-center/knowledge-base',
      '/settings',
      '/settings/billing-usage',
      '/notifications',
      '/mingo',
      '/mingo/chat',
      '/approvals',
    ];
    const active = Object.fromEntries(
      pathnames.map(pathname => [
        pathname,
        getNavigationItems(pathname, allOn, undefined, { inProgress: true, remaining: 1 })
          .filter(item => item.isActive)
          .map(item => item.id)
          .join(','),
      ]),
    );
    expect(active).toMatchSnapshot();
  });

  it('is empty in the auth-only app mode', () => {
    setAppMode('saas-shared');
    const allOn: NavigationFlags = { insights: true, softwareManagement: true, tenantManagement: true };
    expect(getNavigationItems('/devices', allOn, ALL_UNREAD, { inProgress: true, remaining: 2 })).toEqual([]);
  });
});

const ALL_ON: NavigationFlags = { insights: true, softwareManagement: true, tenantManagement: true };
const ALL_OFF: NavigationFlags = { insights: false, softwareManagement: false, tenantManagement: false };

/** `group: child, child` per top-level entry; a leaf is its id alone, `[secondary]` marks the bottom block. */
function outline(items: NavigationSidebarItem[]): string[] {
  return items.map(item => {
    const head = item.section === 'secondary' ? `[secondary] ${item.id}` : item.id;
    return item.children ? `${head}: ${item.children.map(child => child.id).join(', ')}` : head;
  });
}

describe('grouped navigation (Mingo-first shell)', () => {
  it('arranges every module of the saas tenant in the Figma groups, then Knowledge Base, with no Dashboard', () => {
    setAppMode('saas-tenant');
    expect(outline(getGroupedNavigationItems(ALL_ON))).toEqual([
      'inventory: organizations, devices, software, integrations',
      'service-desk: tickets, worktime',
      'automation: scripts, schedules, policies, queries',
      'monitor: incidents, vulnerabilities, logs',
      'knowledge-base',
    ]);
  });

  it('has no bottom block: Help Center and Settings are in the account menu, so the chat history gets the height', () => {
    setAppMode('saas-tenant');
    const items = getGroupedNavigationItems(ALL_ON, ALL_UNREAD);
    const ids = items.flatMap(item => [item, ...(item.children ?? [])]).map(item => item.id);
    expect(items.some(item => item.section === 'secondary')).toBe(false);
    expect(ids).not.toContain('help-center');
    expect(ids).not.toContain('settings');
    // The placeholder is as tall as the loaded tree: four groups and Knowledge Base.
    expect(NAVIGATION_LOADING_ROWS.grouped).toEqual({ primary: 5, secondary: 0 });
  });

  it('keeps an oss tenant with every flag off to the ungated modules', () => {
    setAppMode('oss-tenant');
    expect(outline(getGroupedNavigationItems(ALL_OFF))).toEqual([
      'inventory: organizations, devices',
      'service-desk: worktime',
      'automation: scripts, schedules, policies, queries',
      'monitor: logs',
      'knowledge-base',
    ]);
  });

  it('applies the classic gates to the same modules, in every mode × flag combination', () => {
    for (const mode of ['oss-tenant', 'saas-tenant'] as const) {
      setAppMode(mode);
      const saas = mode === 'saas-tenant';
      for (const flags of FLAG_COMBOS) {
        const grouped = getGroupedNavigationItems(flags).flatMap(item => [item, ...(item.children ?? [])]);
        const flat = getNavigationItems('/', flags);
        const has = (items: NavigationSidebarItem[], id: string) => items.some(item => item.id === id);
        const context = `${mode} ${flagsLabel(flags)}`;

        expect(has(grouped, 'tickets'), context).toBe(saas);
        expect(has(grouped, 'incidents'), context).toBe(saas && flags.insights);
        expect(has(grouped, 'software'), context).toBe(flags.softwareManagement);
        expect(has(grouped, 'vulnerabilities'), context).toBe(flags.softwareManagement);
        expect(has(grouped, 'integrations'), context).toBe(flags.tenantManagement);
        expect(has(grouped, 'dashboard') || has(grouped, 'monitoring'), context).toBe(false);
        // Every module both sidebars show is gated the same way in both.
        for (const id of ['tickets', 'incidents', 'software', 'integrations', 'organizations', 'logs']) {
          expect(has(grouped, id), `${context} ${id}`).toBe(has(flat, id));
        }
      }
    }
  });

  it('puts the Onboarding row first while Get Started is in progress', () => {
    setAppMode('saas-tenant');
    const items = getGroupedNavigationItems(ALL_ON, undefined, { inProgress: true, remaining: 4 });
    expect(items[0]).toMatchObject({ id: 'onboarding', path: '/onboarding', unreadCount: 4 });
    expect(getGroupedNavigationItems(ALL_ON, undefined, { inProgress: false, remaining: 4 })[0].id).toBe('inventory');
  });

  it('labels Cloud tenants by its Figma name and stamps the flagged modules Beta', () => {
    setAppMode('saas-tenant');
    const children = getGroupedNavigationItems(ALL_ON).flatMap(item => item.children ?? []);
    const byId = Object.fromEntries(children.map(child => [child.id, child]));
    expect(byId.integrations).toMatchObject({ label: 'Cloud tenants', badge: 'Beta' });
    expect(byId.software.badge).toBe('Beta');
    expect(byId.incidents.badge).toBe('Beta');
    expect(byId.vulnerabilities.badge).toBeUndefined();
  });

  it('counts unread notifications on the module of their category, and the sum on its group', () => {
    setAppMode('saas-tenant');
    const items = getGroupedNavigationItems(ALL_ON, ALL_UNREAD);
    const unread = Object.fromEntries(
      items
        .flatMap(item => [item, ...(item.children ?? [])])
        .filter(item => item.unreadCount)
        .map(item => [item.id, item.unreadCount]),
    );
    const n = (category: NotificationCategory) => ALL_UNREAD[category] ?? 0;
    expect(unread).toEqual({
      organizations: n('CUSTOMERS'),
      devices: n('DEVICES'),
      // Not counted by the classic sidebar; the grouped one wires it.
      software: n('SOFTWARE'),
      inventory: n('CUSTOMERS') + n('DEVICES') + n('SOFTWARE'),
      tickets: n('TICKETS'),
      'service-desk': n('TICKETS'),
      scripts: n('SCRIPTS'),
      policies: n('MONITORING'),
      automation: n('SCRIPTS') + n('MONITORING'),
      incidents: n('INSIGHTS'),
      logs: n('LOGS'),
      monitor: n('INSIGHTS') + n('LOGS'),
    });
  });

  it('resolves one active entry per route through the entries’ own match rules', () => {
    setAppMode('saas-tenant');
    const items = getGroupedNavigationItems(ALL_ON, undefined, { inProgress: true, remaining: 1 });
    const activeAt = (currentPath: string) => {
      const { activeId, groupId } = resolveNavigationActive(items, { currentPath, includeChildren: true });
      return groupId ? `${groupId}/${activeId}` : (activeId ?? '');
    };
    expect(
      Object.fromEntries(
        [
          '/mingo',
          '/mingo/chat?id=d-1',
          '/approvals',
          '/dashboard',
          '/onboarding',
          '/customers/details?id=1',
          '/devices',
          '/devicesx',
          '/software',
          '/software/actions',
          '/software/vulnerabilities',
          '/software/vulnerability?id=CVE-1',
          '/cloud-tenant-management/details?id=1',
          '/tickets/dialog?id=1',
          '/worktime',
          '/scripts',
          '/scripts/details?id=1',
          '/scripts/schedules',
          '/scripts/schedules/details?id=1',
          '/monitoring',
          '/monitoring?tab=policies',
          '/monitoring?tab=queries',
          '/monitoring/policy?id=1',
          '/monitoring/query?id=1',
          '/incidents',
          '/logs-page',
          '/log-details?id=1',
          '/knowledge-base',
          '/help-center/knowledge-base',
          '/settings/billing-usage',
          '/notifications',
        ].map(path => [path, activeAt(path)]),
      ),
    ).toEqual({
      '/mingo': '',
      '/mingo/chat?id=d-1': '',
      '/approvals': '',
      '/dashboard': '',
      '/onboarding': 'onboarding',
      '/customers/details?id=1': 'inventory/organizations',
      '/devices': 'inventory/devices',
      '/devicesx': '',
      '/software': 'inventory/software',
      '/software/actions': 'inventory/software',
      '/software/vulnerabilities': 'monitor/vulnerabilities',
      '/software/vulnerability?id=CVE-1': 'monitor/vulnerabilities',
      '/cloud-tenant-management/details?id=1': 'inventory/integrations',
      '/tickets/dialog?id=1': 'service-desk/tickets',
      '/worktime': 'service-desk/worktime',
      '/scripts': 'automation/scripts',
      '/scripts/details?id=1': 'automation/scripts',
      '/scripts/schedules': 'automation/schedules',
      '/scripts/schedules/details?id=1': 'automation/schedules',
      '/monitoring': 'automation/policies',
      '/monitoring?tab=policies': 'automation/policies',
      '/monitoring?tab=queries': 'automation/queries',
      '/monitoring/policy?id=1': 'automation/policies',
      '/monitoring/query?id=1': 'automation/queries',
      '/incidents': 'monitor/incidents',
      '/logs-page': 'monitor/logs',
      '/log-details?id=1': 'monitor/logs',
      '/knowledge-base': 'knowledge-base',
      // Help Center and Settings are account-menu entries in this shell, not rows.
      '/help-center/knowledge-base': '',
      '/settings/billing-usage': '',
      '/notifications': '',
    });
  });

  it('is empty in the auth-only app mode', () => {
    setAppMode('saas-shared');
    expect(getGroupedNavigationItems(ALL_ON, ALL_UNREAD, { inProgress: true, remaining: 2 })).toEqual([]);
  });
});
