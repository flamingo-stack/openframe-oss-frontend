import {
  BookBookmarkIcon,
  BracketCurlyIcon,
  ChartDonutIcon,
  ClipboardListIcon,
  ClockHistoryIcon,
  CompassIcon,
  IdCardIcon,
  MonitorIcon,
  QuestionCircleIcon,
  RadarIcon,
  Settings02Icon,
  TagIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { NavigationSidebarItem } from '@flamingo-stack/openframe-frontend-core/types/navigation';
import type { UnreadCountsByCategory } from '@/app/components/notifications/unread-counts-hydrator';
import { NotificationCategory } from '@/generated/schema-enums';
import { isAuthOnlyMode, isSaasTenantMode } from './app-mode';
import { routes } from './routes';

const CATEGORY_BY_NAV_ID: Record<string, NotificationCategory> = {
  dashboard: NotificationCategory.DASHBOARD,
  organizations: NotificationCategory.CUSTOMERS,
  devices: NotificationCategory.DEVICES,
  scripts: NotificationCategory.SCRIPTS,
  monitoring: NotificationCategory.MONITORING,
  logs: NotificationCategory.LOGS,
  tickets: NotificationCategory.TICKETS,
};

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
  timeTracker: boolean;
  helpCenter: boolean;
}

export const getNavigationItems = (
  pathname: string,
  flags: NavigationFlags,
  unreadCounts?: UnreadCountsByCategory,
  onboarding?: OnboardingNavState,
): NavigationSidebarItem[] => {
  if (isAuthOnlyMode()) {
    return [];
  }

  const baseItems: NavigationSidebarItem[] = [
    // Shown only while the user's Get Started onboarding is in progress. Sits at
    // the very top with a count badge of steps still outstanding.
    ...(onboarding?.inProgress
      ? [
          {
            id: 'onboarding',
            label: 'Onboarding',
            icon: <CompassIcon size={24} />,
            path: '/onboarding',
            isActive: pathname.startsWith('/onboarding'),
            // Solid accent pill with the remaining-step count (matches Figma) — the
            // `unreadCount` slot, not `badge` (which is plain accent-colored text).
            unreadCount: onboarding.remaining,
          } satisfies NavigationSidebarItem,
        ]
      : []),
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <ChartDonutIcon size={24} />,
      path: routes.dashboard,
      isActive: pathname.startsWith('/dashboard'),
    },
    {
      id: 'organizations',
      label: 'Customers',
      icon: <IdCardIcon size={24} />,
      path: routes.customers.list(),
      isActive: pathname.startsWith('/customers'),
    },
    {
      id: 'devices',
      label: 'Devices',
      icon: <MonitorIcon size={24} />,
      path: routes.devices.list,
      isActive: pathname.startsWith('/devices'),
    },
    {
      id: 'scripts',
      label: 'Scripts',
      icon: <BracketCurlyIcon size={24} />,
      path: routes.scripts.list,
      isActive: pathname.startsWith('/scripts'),
    },
    {
      id: 'monitoring',
      label: 'Monitoring',
      icon: <RadarIcon size={24} />,
      path: routes.monitoring.root(),
      isActive: pathname.startsWith('/monitoring'),
    },
    {
      id: 'logs',
      label: 'Logs',
      icon: <ClipboardListIcon size={24} />,
      path: routes.logs.page,
      isActive: pathname.startsWith('/logs-page') || pathname.startsWith('/log-details'),
    },
  ];

  if (isSaasTenantMode()) {
    baseItems.push({
      id: 'tickets',
      label: 'Tickets',
      icon: <TagIcon size={24} />,
      path: routes.tickets.list,
      isActive: pathname.startsWith('/tickets'),
    });
  }

  if (flags.timeTracker) {
    baseItems.push({
      id: 'worktime',
      label: 'Worktime',
      icon: <ClockHistoryIcon size={24} />,
      path: routes.worktime,
      isActive: pathname.startsWith('/worktime'),
    });
  }

  baseItems.push({
    id: 'knowledge-base',
    label: 'Knowledge Base',
    icon: <BookBookmarkIcon size={24} />,
    path: routes.knowledgeBase.list,
    section: 'secondary',
    isActive: pathname.startsWith('/knowledge-base'),
  });

  if (flags.helpCenter) {
    baseItems.push({
      id: 'help-center',
      label: 'Help Center',
      icon: <QuestionCircleIcon size={24} />,
      path: routes.helpCenter.root,
      section: 'secondary',
      isActive: pathname.startsWith('/help-center'),
    });
  }

  baseItems.push({
    id: 'settings',
    label: 'Settings',
    icon: <Settings02Icon size={24} />,
    path: routes.settings.root(),
    section: 'secondary',
    isActive: pathname.startsWith('/settings'),
  });

  // TODO: re-enable sidebar unread count badges — flip this flag back to true.
  const showUnreadBadges: boolean = false;

  return baseItems.map(item => {
    if (!showUnreadBadges) return item;
    const category = CATEGORY_BY_NAV_ID[item.id];
    const unreadCount = category ? unreadCounts?.[category] : undefined;
    return unreadCount ? { ...item, unreadCount } : item;
  });
};
