import {
  BracketCurlyIcon,
  ClockHistoryIcon,
  ListBulletIcon,
  MonitorIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { TabItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ComponentType } from 'react';
import { ScheduleDevicesTab } from './schedule-devices-tab';
import { ScheduleExecutionsTab } from './schedule-executions-tab';
import { ScheduleRunsTab } from './schedule-runs-tab';
import { ScheduleScriptsTab } from './schedule-scripts-tab';

/** Everything a schedule tab body needs to know. */
export interface ScheduleTabProps {
  scheduleId: string;
}

/**
 * The schedule details tabs: label, icon and BODY, one entry per tab.
 *
 * The body travels with the tab — the `component` field the core `TabItem`
 * already carries, resolved through {@link scheduleTabBody} — so adding a tab is
 * one entry here and the page never learns the ids. Same shape the customer
 * details tabs use.
 *
 * Each body is `memo`'d at its own export, and that is load-bearing:
 * `TabNavigation` DEFERS the body, so one switch runs its render prop twice —
 * once with the tab being left, once with the new one — and it runs again on any
 * query-param change (the page writes `?tab=` on every click). Unmemoized, each
 * of those re-renders whichever heavy table is open.
 *
 * Every body also owns its own Suspense boundary, so a switch loads a tab and
 * never the page. Where the boundary sits differs on purpose: Scheduled Scripts
 * and Assigned Devices wrap themselves, while Schedule Runs and Execution
 * History put theirs BELOW their own toolbar so a filter change reloads the rows
 * and leaves the search box where it was.
 *
 * "Schedule Runs" is the aggregate (one row per fire of the schedule);
 * "Execution History" is the flat per-script-per-device history under those fires.
 */
export const SCHEDULE_DETAIL_TABS: TabItem[] = [
  { id: 'scripts', label: 'Scheduled Scripts', icon: BracketCurlyIcon, component: ScheduleScriptsTab },
  { id: 'devices', label: 'Assigned Devices', icon: MonitorIcon, component: ScheduleDevicesTab },
  { id: 'runs', label: 'Schedule Runs', icon: ClockHistoryIcon, component: ScheduleRunsTab },
  { id: 'executions', label: 'Execution History', icon: ListBulletIcon, component: ScheduleExecutionsTab },
];

/** What an absent or unrecognised `?tab=` resolves to — the first tab, as the strip reads. */
export const SCHEDULE_DEFAULT_TAB = SCHEDULE_DETAIL_TABS[0].id;

/** The body registered for `tabId`, falling back to the default tab's. */
export function scheduleTabBody(tabId: string): ComponentType<ScheduleTabProps> {
  const tab = SCHEDULE_DETAIL_TABS.find(item => item.id === tabId) ?? SCHEDULE_DETAIL_TABS[0];
  return tab.component as ComponentType<ScheduleTabProps>;
}
