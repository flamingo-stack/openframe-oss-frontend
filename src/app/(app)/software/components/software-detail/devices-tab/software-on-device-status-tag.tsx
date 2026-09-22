'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { DotsLoaderIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { presentationFor } from '@/lib/exhaustive-map';
import { SOFTWARE_ON_DEVICE_STATUS } from './software-on-device-status';

/**
 * The chip beside a device's installed version — nothing for a state that needs
 * no attention, or one this build does not know (Relay's `'%future added value'`).
 */
export function SoftwareOnDeviceStatusTag({ status }: { status: string | null | undefined }) {
  const presentation = presentationFor(SOFTWARE_ON_DEVICE_STATUS, status);
  if (!presentation?.tag) return null;
  const { variant, inFlight } = presentation.tag;
  return (
    <Tag
      label={presentation.label}
      variant={variant}
      icon={inFlight ? <DotsLoaderIcon className="h-4 w-4" /> : undefined}
    />
  );
}
