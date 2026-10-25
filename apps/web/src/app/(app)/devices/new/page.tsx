'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { NO_ITEMS } from '@/app/components/shared';
import { NewDeviceContent, NewDeviceForm } from './new-device-content';

export default function NewDevicePage() {
  return (
    // loading-standard-ok(PAGE_BOUNDARY): the page is one form whose organization field seeds its state; it waits whole
    <LoadingSuspense label="Loading device setup" fallback={<NewDeviceForm orgs={NO_ITEMS} preselectedOrgId={null} />}>
      <NewDeviceContent />
    </LoadingSuspense>
  );
}
