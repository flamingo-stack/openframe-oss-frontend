import type { TabItem } from '@flamingo-stack/openframe-frontend-core';
import {
  AlertTriangleIcon,
  BellSnoozeIcon,
  BoxArchiveIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { InsightStatus } from '@/generated/schema-enums';
import { type IncidentsTab, TAB_IDS } from '@/lib/routes';
import {
  ARCHIVED_INCIDENT_STATUSES,
  CURRENT_INCIDENT_STATUSES,
  SNOOZED_INCIDENT_STATUSES,
} from '../utils/incident-labels';

interface IncidentTabView {
  title: string;
  icon: NonNullable<TabItem['icon']>;
  statuses: readonly InsightStatus[];
  /** Offers "Archive Resolved" in the header. */
  archiveResolved: boolean;
  empty: { title: string; description: string };
}

/** Everything that differs between the Incidents page's tabs. */
export const INCIDENT_TAB_VIEWS: Record<IncidentsTab, IncidentTabView> = {
  current: {
    title: 'Current Incidents',
    icon: AlertTriangleIcon,
    statuses: CURRENT_INCIDENT_STATUSES,
    archiveResolved: true,
    empty: { title: 'No incidents detected', description: 'Your monitored devices are all clear' },
  },
  snoozed: {
    title: 'Snoozed Incidents',
    icon: BellSnoozeIcon,
    statuses: SNOOZED_INCIDENT_STATUSES,
    archiveResolved: false,
    empty: { title: 'No snoozed incidents', description: 'Incidents you snooze wait here until they come back' },
  },
  archived: {
    title: 'Archived Incidents',
    icon: BoxArchiveIcon,
    statuses: ARCHIVED_INCIDENT_STATUSES,
    archiveResolved: false,
    empty: { title: 'No archived incidents', description: 'Resolved incidents you archive are kept here' },
  },
};

export const INCIDENTS_TABS: TabItem[] = TAB_IDS.incidents.map(id => ({
  id,
  label: INCIDENT_TAB_VIEWS[id].title,
  icon: INCIDENT_TAB_VIEWS[id].icon,
}));

export function isIncidentsTab(value: string): value is IncidentsTab {
  return TAB_IDS.incidents.some(tab => tab === value);
}

/** The "Archive Resolved" header button. */
export function archiveResolvedAction(onClick: () => void): PageActionButton {
  return {
    label: 'Archive Resolved',
    onClick,
    icon: <BoxArchiveIcon className="h-5 w-5 text-ods-text-secondary" />,
    variant: 'outline',
  };
}
