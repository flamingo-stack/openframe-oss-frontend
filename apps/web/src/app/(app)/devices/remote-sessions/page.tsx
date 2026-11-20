'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { routes } from '@/lib/routes';
import { DevicesTabNavigation, REMOTE_SESSIONS_PAGE_TITLE } from '../components/devices-tab-navigation';
import { RecordingStorageBanner } from '../components/remote-sessions/recording-storage-banner';
import { TenantSessionsShell } from '../components/remote-sessions/tenant-sessions-table';
import { useSessionRecordingsGate } from '../hooks/use-session-recordings-gate';

/** The tenant's remote sessions on every device - the Devices page's second tab. */
export default function RemoteSessionsPage() {
  const router = useRouter();
  const gate = useSessionRecordingsGate();
  // The new grid table, behind the app's one table flag; card rows while it is off.
  const tableGate = useTableGridGate();

  useEffect(() => {
    if (gate === 'off') router.replace(routes.devices.list);
  }, [gate, router]);

  // Until the gates answer the page draws itself: the sessions table its own loading state, asking for nothing. The
  // table flag is one of them, so the table never draws one layout and swaps to the other.
  const loading = gate !== 'on';
  const tableLoading = loading || tableGate === 'loading';
  return (
    <div className="flex w-full flex-col">
      <DevicesTabNavigation activeTab="remote-sessions" />
      <PageLayout
        title={REMOTE_SESSIONS_PAGE_TITLE}
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      >
        {/* Shown only while the tenant's recording storage is full, which is rare, and only once its own read answers. */}
        {!loading && <RecordingStorageBanner data-loading-optional />}
        <ContentErrorBoundary title="Remote Sessions" message="Couldn't load remote sessions.">
          <LoadingWhen loading={tableLoading}>
            <TenantSessionsShell tableLayout={tableLayoutFor(tableGate)} />
          </LoadingWhen>
        </ContentErrorBoundary>
      </PageLayout>
    </div>
  );
}
