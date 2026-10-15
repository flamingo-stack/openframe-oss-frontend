'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core';
import { navigatesCurrentWindow } from '@/lib/link-click';
import { routes } from '@/lib/routes';

/**
 * The box of the default `DeviceDetailsButton` ("Details", the lib's default-size outline button), for
 * a loading card that holds its place (`DeviceCardSkeleton`'s `detailsButtonClassName`): the button's
 * `h-11 md:h-12`, and its width as the label's (about 3.2em of bold `text-h3`) plus the two side paddings.
 */
export const DEVICE_DETAILS_BUTTON_BOX = 'h-11 w-[calc(3.2em+2*var(--spacing-system-m))] text-h3 md:h-12';

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
