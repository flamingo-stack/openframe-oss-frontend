'use client';

import {
  type DevicesViewConfig as DevicesViewConfigValue,
  DevicesViewConfigProvider,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { type ReactNode, useMemo } from 'react';
import { useIsMobileShell } from '@/app/hooks/use-is-mobile-shell';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';

/**
 * What the core library's device views (the devices table and grid, the device
 * picker) need from this app and cannot know themselves: where a device's page
 * lives, how a customer image's path becomes a URL, and whether the page runs
 * in the mobile shell. Mounted once in the root layout, above every page.
 */
export function DevicesViewConfig({ children }: { children: ReactNode }) {
  const isMobileShell = useIsMobileShell();
  const value = useMemo<DevicesViewConfigValue>(
    () => ({
      getDeviceHref: device => routes.devices.details(device.machineId || device.id),
      resolveImageUrl: getFullImageUrl,
      isMobileShell,
    }),
    [isMobileShell],
  );
  return <DevicesViewConfigProvider value={value}>{children}</DevicesViewConfigProvider>;
}
