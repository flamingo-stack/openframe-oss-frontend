import type { TabItem } from '@flamingo-stack/openframe-frontend-core';
import {
  AlertTriangleIcon,
  BellSnoozeIcon,
  BoxArchiveIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import type { InsightStatus } from '@/generated/schema-enums';
import { type IncidentsTab, TAB_IDS } from '@/lib/routes';
import {
  ARCHIVED_INCIDENT_STATUSES,
  CURRENT_INCIDENT_STATUSES,
  SNOOZED_INCIDENT_STATUSES,
} from '../utils/incident-labels';
import { INCIDENTS_TABLE_COLUMNS, LOCKED_STATUS_INCIDENTS_TABLE_COLUMNS } from './incidents-table-columns';

interface IncidentTabView {
  title: string;
  icon: NonNullable<TabItem['icon']>;
  /** The tab's cell in the loading tab bar. */
  tabWidth: string;
  statuses: readonly InsightStatus[];
  /** The table's layout, read by the page's loading skeleton and the table's own. */
  columns: readonly TableSkeletonColumn[];
  /** Offers "Archive Resolved" in the header. */
  archiveResolved: boolean;
  empty: { title: string; description: string };
}

/** A single-status tab has no Status filter — the live table decides the same from `statuses`. */
function columnsFor(statuses: readonly InsightStatus[]): readonly TableSkeletonColumn[] {
  return statuses.length === 1 ? LOCKED_STATUS_INCIDENTS_TABLE_COLUMNS : INCIDENTS_TABLE_COLUMNS;
}

/** Everything that differs between the Incidents page's tabs. */
export const INCIDENT_TAB_VIEWS: Record<IncidentsTab, IncidentTabView> = {
  current: {
    title: 'Current Incidents',
    icon: AlertTriangleIcon,
    tabWidth: 'w-[190px]',
    statuses: CURRENT_INCIDENT_STATUSES,
    columns: columnsFor(CURRENT_INCIDENT_STATUSES),
    archiveResolved: true,
    empty: { title: 'No incidents detected', description: 'Your monitored devices are all clear' },
  },
  snoozed: {
    title: 'Snoozed Incidents',
    icon: BellSnoozeIcon,
    tabWidth: 'w-[200px]',
    statuses: SNOOZED_INCIDENT_STATUSES,
    columns: columnsFor(SNOOZED_INCIDENT_STATUSES),
    archiveResolved: false,
    empty: { title: 'No snoozed incidents', description: 'Incidents you snooze wait here until they come back' },
  },
  archived: {
    title: 'Archived Incidents',
    icon: BoxArchiveIcon,
    tabWidth: 'w-[200px]',
    statuses: ARCHIVED_INCIDENT_STATUSES,
    columns: columnsFor(ARCHIVED_INCIDENT_STATUSES),
    archiveResolved: false,
    empty: { title: 'No archived incidents', description: 'Resolved incidents you archive are kept here' },
  },
};

export const INCIDENTS_TABS: TabItem[] = TAB_IDS.incidents.map(id => ({
  id,
  label: INCIDENT_TAB_VIEWS[id].title,
  icon: INCIDENT_TAB_VIEWS[id].icon,
}));

export const INCIDENTS_TAB_WIDTHS = TAB_IDS.incidents.map(id => INCIDENT_TAB_VIEWS[id].tabWidth);

export function isIncidentsTab(value: string): value is IncidentsTab {
  return TAB_IDS.incidents.some(tab => tab === value);
}

/**
 * The "Archive Resolved" header button. Without `onClick` it is the loading
 * copy: same size, disabled, so the header does not move when the page lands.
 */
export function archiveResolvedAction(onClick?: () => void): PageActionButton {
  return {
    label: 'Archive Resolved',
    ...(onClick ? { onClick } : { disabled: true }),
    icon: <BoxArchiveIcon className="h-5 w-5 text-ods-text-secondary" />,
    variant: 'outline',
  };
}
