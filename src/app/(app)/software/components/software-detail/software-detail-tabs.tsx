'use client';

import { TabNavigation } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SOFTWARE_DEFAULT_TAB, SOFTWARE_DETAIL_TABS, softwareTabBody } from './software-detail-tab-items';

/**
 * The tab strip and whichever body it is on. The bodies fetch by id themselves;
 * `loading` tells them not to yet (the module's flag has not answered).
 */
export function SoftwareDetailTabs({ softwareId, loading = false }: { softwareId: string; loading?: boolean }) {
  return (
    <TabNavigation tabs={SOFTWARE_DETAIL_TABS} urlSync defaultTab={SOFTWARE_DEFAULT_TAB}>
      {activeTab => {
        const TabBody = softwareTabBody(activeTab);
        return <TabBody softwareId={softwareId} loading={loading} />;
      }}
    </TabNavigation>
  );
}
