'use client';

import { Button, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { FileManagerSkeleton } from '@flamingo-stack/openframe-frontend-core/components/ui/file-manager';
import { useSearchParams } from 'next/navigation';
import { FileManagerContainer } from '@/app/(app)/devices/details/file-manager/components/file-manager-container';
import { useDeviceDetails } from '@/app/(app)/devices/hooks/use-device-details';
import { getToolConnection } from '@/app/(app)/devices/utils/device-action-utils';
import { getMeshCentralBlockedCopy, getToolConnectionState } from '@/app/(app)/devices/utils/tool-connection-status';
import { CONTEXT_ENTITY_KIND } from '@/app/(app)/mingo/context/context-types';
import { useTrackOpenView } from '@/app/(app)/mingo/context/use-track-open-view';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';

// Horizontal padding only — `PageLayout`'s `TitleBlock` already supplies the
// top padding (`pt-[var(--spacing-system-l)]` = 16/24px, matching the former pt-4/md:pt-6).
const PAGE_PADDING = 'px-4 md:px-6';

export default function FileManagerPage() {
  const deviceId = useSearchParams().get('id') ?? '';
  const handleBack = useSafeBack(routes.devices.details(deviceId));

  const { deviceDetails, isLoading, error } = useDeviceDetails(deviceId, { polling: false });

  const meshcentralConnection = getToolConnection(deviceDetails?.toolConnections, 'MESHCENTRAL');
  const meshcentralState = getToolConnectionState(meshcentralConnection);
  const meshcentralAgentId = meshcentralState === 'live' ? meshcentralConnection?.agentToolId : undefined;

  // Keep this device as the Mingo "open view" while on the file-manager surface
  // (the parent detail page unmounted on navigation, clearing its own openView).
  // Above the early returns so hook order stays stable.
  useTrackOpenView(
    deviceDetails
      ? {
          type: CONTEXT_ENTITY_KIND.DEVICE,
          id: deviceId,
          label: deviceDetails.hostname || deviceDetails.displayName || deviceId,
        }
      : null,
  );

  if (isLoading) {
    return <FileManagerPageSkeleton onBack={handleBack} />;
  }

  if (error) {
    return (
      <PageLayout
        title="File Manager"
        className={`${PAGE_PADDING} h-full`}
        contentClassName="flex min-h-0 flex-col overflow-hidden"
        backButton={{ label: 'Back', onClick: handleBack }}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="text-ods-error text-h4">Error: {error}</div>
          <Button variant="outline" onClick={handleBack}>
            Return to Device Details
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (!meshcentralAgentId) {
    return (
      <PageLayout
        title="File Manager"
        className={`${PAGE_PADDING} h-full`}
        contentClassName="flex min-h-0 flex-col overflow-hidden"
        backButton={{ label: 'Back', onClick: handleBack }}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="text-ods-error text-h4">
            {getMeshCentralBlockedCopy(meshcentralState, 'File manager').title}
          </div>
          <p className="text-ods-text-secondary">
            {getMeshCentralBlockedCopy(meshcentralState, 'File manager').description}
          </p>
          <Button variant="outline" onClick={handleBack}>
            Return to Device Details
          </Button>
        </div>
      </PageLayout>
    );
  }

  const hostname = deviceDetails?.hostname || deviceDetails?.displayName;

  return (
    <FileManagerContainer
      deviceId={deviceId}
      meshcentralAgentId={meshcentralAgentId}
      hostname={hostname}
      className={PAGE_PADDING}
    />
  );
}

interface FileManagerPageSkeletonProps {
  onBack: () => void;
}

function FileManagerPageSkeleton({ onBack }: FileManagerPageSkeletonProps) {
  return (
    <PageLayout
      title="File Manager"
      className={`${PAGE_PADDING} h-full`}
      contentClassName="flex min-h-0 flex-col overflow-hidden"
      backButton={{
        label: 'Back',
        onClick: onBack,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <FileManagerSkeleton />
      </div>
    </PageLayout>
  );
}
