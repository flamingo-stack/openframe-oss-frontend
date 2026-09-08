import { BracketCurlyIcon, ClockHistoryIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { TabItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ComponentType } from 'react';
import { ScriptDetailsTab } from './script-details-tab';
import { ScriptExecutionsTab } from './script-executions-tab';

/** Everything a script tab body needs to know. */
export interface ScriptTabProps {
  scriptId: string;
}

/**
 * The script details tabs: label, icon and BODY, one entry per tab. Two only —
 * Schedules is intentionally omitted from the v2 details page.
 *
 * The body travels with the tab — the `component` field the core `TabItem`
 * already carries, resolved through {@link scriptTabBody} — so adding a tab is
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
 * never the page. Where the boundary sits differs on purpose: Script Details
 * wraps itself, while Execution History puts its own BELOW its toolbar so a
 * filter change reloads the rows and leaves the search box where it was.
 */
export const DETAIL_TABS: TabItem[] = [
  { id: 'details', label: 'Script Details', icon: BracketCurlyIcon, component: ScriptDetailsTab },
  { id: 'executions', label: 'Execution History', icon: ClockHistoryIcon, component: ScriptExecutionsTab },
];

/** What an absent or unrecognised `?tab=` resolves to — the first tab, as the strip reads. */
export const SCRIPT_DEFAULT_TAB = DETAIL_TABS[0].id;

/** The body registered for `tabId`, falling back to the default tab's. */
export function scriptTabBody(tabId: string): ComponentType<ScriptTabProps> {
  const tab = DETAIL_TABS.find(item => item.id === tabId) ?? DETAIL_TABS[0];
  return tab.component as ComponentType<ScriptTabProps>;
}
