'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import { Suspense } from 'react';
import type { DeviceOrganizationOption } from '../hooks/use-device-organizations';
import { NewDeviceContent, NewDeviceForm } from './new-device-content';

const NO_ORGANIZATIONS: readonly DeviceOrganizationOption[] = [];

export default function NewDevicePage() {
  return (
    <Suspense
      fallback={
        <LoadingFallback label="Loading device setup">
          <NewDeviceForm orgs={NO_ORGANIZATIONS} preselectedOrgId={null} />
        </LoadingFallback>
      }
    >
      <NewDeviceContent />
    </Suspense>
  );
}
