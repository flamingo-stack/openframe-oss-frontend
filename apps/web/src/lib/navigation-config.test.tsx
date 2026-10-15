import type { NavigationSidebarItem } from '@flamingo-stack/openframe-frontend-core/types/navigation';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { UnreadCountsByCategory } from '@/app/components/notifications/unread-counts-hydrator';
import { NotificationCategory } from '@/generated/schema-enums';
import { getNavigationItems, type NavigationFlags, type OnboardingNavState } from './navigation-config';

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
