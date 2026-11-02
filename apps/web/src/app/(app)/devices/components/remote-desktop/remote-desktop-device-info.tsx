'use client';

import { MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { DeviceIdentity } from '../device-identity';

const ICON_TILE_CLASS = 'flex-shrink-0 rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xsf)]';

/** Which device the remote desktop shows: its name over "Desktop • <customer>". Draws itself in a loading scope. */
export function RemoteDesktopDeviceInfo({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <DeviceIdentity
      className="gap-[var(--spacing-system-m)]"
      icon={
        <div className={ICON_TILE_CLASS}>
          <MonitorIcon className="h-4 w-4 text-ods-text-secondary" />
        </div>
      }
      title={title}
      subtitle={subtitle}
    />
  );
}
