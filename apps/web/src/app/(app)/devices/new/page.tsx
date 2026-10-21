'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import type { DeviceOrganizationOption } from '../hooks/use-device-organizations';
import { NewDeviceContent, NewDeviceForm } from './new-device-content';

const NO_ORGANIZATIONS: readonly DeviceOrganizationOption[] = [];

export default function NewDevicePage() {
  return (
    <LoadingSuspense
      label="Loading device setup"
      fallback={<NewDeviceForm orgs={NO_ORGANIZATIONS} preselectedOrgId={null} />}
    >
      <NewDeviceContent />
    </LoadingSuspense>
  );
}
