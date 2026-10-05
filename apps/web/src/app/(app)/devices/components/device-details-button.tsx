'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core';
import { navigatesCurrentWindow } from '@/lib/link-click';
import { routes } from '@/lib/routes';

interface DeviceDetailsButtonProps {
  deviceId?: string;
  machineId?: string;
  label?: string;
  variant?: 'accent' | 'outline';
  className?: string;
  openInNewTab?: boolean;
  /**
   * Fires when the click actually navigates this window — not a modifier/middle
   * click, not `openInNewTab`. Lets an enclosing overlay dismiss itself: the
   * target is a `?id=` detail URL, so a click landing on the device the user is
   * ALREADY viewing changes nothing on screen and reads as dead unless whatever
   * covers the page gets out of the way (see `LogDrawer`).
   */
  onNavigate?: () => void;
}

export function DeviceDetailsButton({
  deviceId,
  machineId,
  label = 'Details',
  variant = 'outline',
  className,
  openInNewTab = false,
  onNavigate,
}: DeviceDetailsButtonProps) {
  const id = machineId || deviceId;

  if (!id) {
    return null;
  }

  return (
    <Button
      variant={variant}
      href={routes.devices.details(id)}
      openInNewTab={openInNewTab}
      className={className}
      onClick={event => {
        if (!openInNewTab && navigatesCurrentWindow(event)) onNavigate?.();
      }}
    >
      {label}
    </Button>
  );
}
