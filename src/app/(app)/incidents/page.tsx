'use client';

import { TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { notFound } from 'next/navigation';
import { ContentErrorBoundary, ListPageSkeleton } from '@/app/components/shared';
import type { IncidentsTab } from '@/lib/routes';
import { INCIDENT_FILTER_PARAMS, IncidentsTable, NO_INCIDENT_FILTERS } from './components/incidents-table';
import {
  archiveResolvedAction,
  INCIDENT_TAB_VIEWS,
  INCIDENTS_TAB_WIDTHS,
  INCIDENTS_TABS,
  isIncidentsTab,
} from './components/incidents-tabs';
import { useIncidentsGate } from './hooks/use-incidents-gate';

export default function IncidentsPage() {
  const gate = useIncidentsGate();
  // The filter params are declared here too (owned by IncidentsTable) so a tab
  // switch can clear them — each tab starts unfiltered, and a status chosen on
  // Current means nothing on Snoozed.
  const { params, setParams } = useApiParams({
    tab: { type: 'string', default: 'current' },
    ...INCIDENT_FILTER_PARAMS,
  });
  const tab: IncidentsTab = isIncidentsTab(params.tab) ? params.tab : 'current';
  const view = INCIDENT_TAB_VIEWS[tab];

  // Only a definitive "off" 404s: `notFound()` throws, and throwing while the
  // flags are merely unanswered is unrecoverable (see notifications/page.tsx).
  if (gate === 'off') {
    notFound();
  }
  if (gate === 'loading') {
    return (
      <ListPageSkeleton
        title={view.title}
        actions={view.archiveResolved ? [archiveResolvedAction()] : undefined}
        tabWidths={INCIDENTS_TAB_WIDTHS}
        columns={view.columns}
      />
    );
  }

  return (
    <div className="flex w-full flex-col">
      <div className="px-[var(--spacing-system-l)]">
        <TabNavigation
          urlSync={false}
          activeTab={tab}
          tabs={INCIDENTS_TABS}
          onTabChange={next => setParams({ tab: next, ...NO_INCIDENT_FILTERS })}
        />
      </div>
      {/* `resetKey`: a tab switch is a fresh start, so it clears a failure left by the tab before. */}
      <ContentErrorBoundary title={view.title} message="Couldn't load incidents." resetKey={tab}>
        {/* Keyed so a tab switch starts the tab fresh: its search box, confirm dialog and refetch counter. */}
        <IncidentsTable key={tab} tab={tab} />
      </ContentErrorBoundary>
    </div>
  );
}
