'use client';

import { getTabComponent } from '@flamingo-stack/openframe-frontend-core';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { MonitoringTabNavigation, useMonitoringTabs } from './components/tabs/monitoring-tabs';

export default function Monitoring() {
  // `search` is declared here too (owned by the tabs) so we can clear it on
  // a tab switch — each tab starts with a fresh search.
  const { params, setParams } = useApiParams({
    tab: { type: 'string', default: 'policies' },
    search: { type: 'string', default: '' },
  });

  const tabs = useMonitoringTabs();
  // Checks behind its gate: the link lands on Queries, the page it sits beside.
  const checksClosed = params.tab === 'checks' && !tabs.some(tab => tab.id === 'checks');
  const activeTab = checksClosed ? 'queries' : params.tab;
  const TabComponent = getTabComponent(tabs, activeTab);

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-col">
        <MonitoringTabNavigation activeTab={activeTab} onTabChange={tab => setParams({ tab, search: '' })} />
        {TabComponent ? <TabComponent /> : null}
      </div>
    </div>
  );
}
