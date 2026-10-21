'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';

const ICON_TILE_CLASS = 'flex-shrink-0 rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xsf)]';

/** The device block while the device is read: the real icon tile beside the name and customer bars. */
function RemoteDesktopDeviceInfoSkeleton() {
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-m)]">
      <div className={ICON_TILE_CLASS}>
        <MonitorIcon className="h-4 w-4 text-ods-text-secondary" />
      </div>
      <div className="flex min-w-0 flex-col">
        <TextLineSkeleton type="h4" className="w-48" />
        <TextLineSkeleton type="h6" className="w-36" />
      </div>
    </div>
  );
}

/** Which device the remote desktop shows: its name over "Desktop • <customer>". */
export function RemoteDesktopDeviceInfo({ title, subtitle }: { title: string; subtitle: string }) {
  if (useLoadingScope()) {
    return <RemoteDesktopDeviceInfoSkeleton />;
  }

  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-m)]">
      <div className={ICON_TILE_CLASS}>
        <MonitorIcon className="h-4 w-4 text-ods-text-secondary" />
      </div>
      <div className="flex min-w-0 flex-col">
        <TruncateText>{title}</TruncateText>
        <TruncateText variant="h6" tone="secondary">
          {subtitle}
        </TruncateText>
      </div>
    </div>
  );
}
