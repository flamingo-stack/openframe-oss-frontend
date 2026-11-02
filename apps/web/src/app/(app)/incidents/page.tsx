'use client';

import { TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { notFound } from 'next/navigation';
import { ContentErrorBoundary } from '@/app/components/shared';
import type { IncidentsTab } from '@/lib/routes';
import { INCIDENT_FILTER_PARAMS, IncidentsTable, NO_INCIDENT_FILTERS } from './components/incidents-table';
import { INCIDENT_TAB_VIEWS, INCIDENTS_TABS, isIncidentsTab } from './components/incidents-tabs';
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
  // flags are merely unanswered is unrecoverable (see `use-feature-flag.ts`).
  if (gate === 'off') {
    notFound();
  }
  // While the flag is unanswered the page draws itself in a loading scope: each part its own skeleton.
  return (
    <LoadingWhen loading={gate === 'loading'}>
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
    </LoadingWhen>
  );
}
