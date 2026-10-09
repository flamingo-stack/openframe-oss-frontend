'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { CompactPageLoader } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { routes } from '@/lib/routes';
import { DevicesTabNavigation, REMOTE_SESSIONS_PAGE_TITLE } from '../components/devices-tab-navigation';
import { RecordingStorageBanner } from '../components/remote-sessions/recording-storage-banner';
import { TenantSessionsShell } from '../components/remote-sessions/tenant-sessions-table';
import { useSessionRecordingsGate } from '../hooks/use-session-recordings-gate';

/** The tenant's remote sessions on every device - the Devices page's second tab. */
export default function RemoteSessionsPage() {
  const router = useRouter();
  const gate = useSessionRecordingsGate();

  useEffect(() => {
    if (gate === 'off') router.replace(routes.devices.list);
  }, [gate, router]);

  if (gate !== 'on') return <CompactPageLoader />;
  return (
    <div className="flex w-full flex-col">
      <DevicesTabNavigation activeTab="remote-sessions" />
      <PageLayout
        title={REMOTE_SESSIONS_PAGE_TITLE}
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      >
        <RecordingStorageBanner />
        <ContentErrorBoundary title="Remote Sessions" message="Couldn't load remote sessions.">
          <TenantSessionsShell />
        </ContentErrorBoundary>
      </PageLayout>
    </div>
  );
}
